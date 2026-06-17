import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as advancedFormat from 'dayjs/plugin/advancedFormat';
import * as isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
dayjs.extend(isoWeek);

import { IntakeTrendResponseDto } from './dto/intake-trend.dto';

export interface IntakeTrendContext {
  unit: 'weekly' | 'monthly';
  daysInPeriod: number;
  labelFormat: string;
  currentRange: { start: dayjs.Dayjs; end: dayjs.Dayjs };
  chartRanges: { start: dayjs.Dayjs; end: dayjs.Dayjs }[];
}

export interface DetailedIntake {
  id: number;
  caffeine: number;
  created_at: Date;
  brand_id: number;
  brand_name: string;
}

export class IntakeTrendBuilder {
  private result: Partial<IntakeTrendResponseDto> = {};
  private currentIntakes: DetailedIntake[];

  constructor(
    private readonly context: IntakeTrendContext,
    private readonly allIntakes: DetailedIntake[],
  ) {
    this.currentIntakes = allIntakes.filter((i) => {
      const d = dayjs(i.created_at).add(9, 'hour');
      return (
        (d.isAfter(context.currentRange.start) ||
          d.isSame(context.currentRange.start)) &&
        (d.isBefore(context.currentRange.end) ||
          d.isSame(context.currentRange.end))
      );
    });
  }

  buildChart(): this {
    this.result.chart = this.context.chartRanges.map((range) => {
      const periodIntakes = this.allIntakes.filter((intake) => {
        const d = dayjs(intake.created_at).add(9, 'hour');
        return (
          (d.isAfter(range.start) || d.isSame(range.start)) &&
          (d.isBefore(range.end) || d.isSame(range.end))
        );
      });

      let label = '';
      if (this.context.unit === 'weekly') {
        label = `${range.start.format('MM.DD')} - ${range.end.format('MM.DD')}`;
      } else {
        label = range.start.format('YYYY.MM');
      }

      return {
        label,
        cups: periodIntakes.length,
        caffeineMg: periodIntakes.reduce((sum, i) => sum + i.caffeine, 0),
      };
    });
    return this;
  }

  buildMetrics(): this {
    const dailySumMap: Record<string, number> = {};
    this.currentIntakes.forEach((i) => {
      const day = dayjs(i.created_at).add(9, 'hour').format('YYYY-MM-DD');
      dailySumMap[day] = (dailySumMap[day] || 0) + i.caffeine;
    });

    const totalCups = this.currentIntakes.length;
    const rawAverage = totalCups / this.context.daysInPeriod;
    // Round to 1 decimal place using standard rounding
    const dailyAverage = Math.round(rawAverage * 10) / 10;

    this.result.metrics = {
      dailyAverage,
      sum: totalCups,
      totalDays: Object.keys(dailySumMap).length,
    };
    return this;
  }

  buildThresholds(): this {
    const dailySumMap: Record<string, number> = {};
    this.currentIntakes.forEach((i) => {
      const day = dayjs(i.created_at).add(9, 'hour').format('YYYY-MM-DD');
      dailySumMap[day] = (dailySumMap[day] || 0) + i.caffeine;
    });

    let excessiveCount = 0;
    let moderateCount = 0;

    Object.values(dailySumMap).forEach((dayCaffeine) => {
      if (dayCaffeine > 400) {
        excessiveCount++;
      } else if (dayCaffeine > 0) {
        moderateCount++;
      }
    });

    this.result.threshold = {
      excessiveCount,
      moderateCount,
    };
    return this;
  }

  buildRankings(): this {
    const brandMap: Record<
      string,
      { brand: string; cups: number; caffeine: number }
    > = {};

    this.currentIntakes.forEach((i) => {
      if (!brandMap[i.brand_name]) {
        brandMap[i.brand_name] = { brand: i.brand_name, cups: 0, caffeine: 0 };
      }
      brandMap[i.brand_name].cups++;
      brandMap[i.brand_name].caffeine += i.caffeine;
    });

    this.result.ranking = Object.values(brandMap)
      .sort((a, b) => b.cups - a.cups || b.caffeine - a.caffeine)
      .slice(0, 5);

    return this;
  }

  getResult(): IntakeTrendResponseDto {
    return this.result as IntakeTrendResponseDto;
  }
}

export function createIntakeTrendContext(
  anchor: dayjs.Dayjs,
  unit: 'weekly' | 'monthly',
): IntakeTrendContext {
  const chartRanges: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];

  if (unit === 'weekly') {
    const thisWeekStart = anchor.startOf('isoWeek');
    const thisWeekEnd = anchor.endOf('isoWeek');

    for (let i = 6; i >= 1; i--) {
      const weekStart = thisWeekStart.subtract(i, 'week');
      chartRanges.push({
        start: weekStart,
        end: weekStart.endOf('isoWeek'),
      });
    }
    chartRanges.push({ start: thisWeekStart, end: thisWeekEnd });

    return {
      unit,
      daysInPeriod: 7,
      labelFormat: 'MM.DD - MM.DD',
      currentRange: { start: thisWeekStart, end: thisWeekEnd },
      chartRanges,
    };
  } else {
    const thisMonthStart = anchor.startOf('month');
    const thisMonthEnd = anchor.endOf('month');

    for (let i = 6; i >= 0; i--) {
      const monthStart = thisMonthStart.subtract(i, 'month');
      chartRanges.push({
        start: monthStart,
        end: monthStart.endOf('month'),
      });
    }

    return {
      unit,
      daysInPeriod: anchor.daysInMonth(),
      labelFormat: 'YYYY.MM',
      currentRange: { start: thisMonthStart, end: thisMonthEnd },
      chartRanges,
    };
  }
}
