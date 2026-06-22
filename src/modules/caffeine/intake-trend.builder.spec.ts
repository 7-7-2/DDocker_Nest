import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';
import { DateUtil } from '../../common/utils/date.util';
import {
  IntakeTrendBuilder,
  createIntakeTrendContext,
  DetailedIntake,
} from './intake-trend.builder';

dayjs.extend(utc);
dayjs.extend(isoWeek);

describe('IntakeTrendBuilder', () => {
  // Use a fixed UTC string and then toKst to avoid any local machine timezone interference
  const anchor = DateUtil.toKst('2024-06-16'); // Sunday

  const mockIntakes: DetailedIntake[] = [
    {
      id: 1,
      caffeine: 150,
      created_at: new Date('2024-06-16T01:00:00Z'),
      brand_id: 1,
      brand_name: 'Starbucks',
    },
    {
      id: 2,
      caffeine: 300,
      created_at: new Date('2024-06-16T05:00:00Z'),
      brand_id: 1,
      brand_name: 'Starbucks',
    },
    {
      id: 3,
      caffeine: 100,
      created_at: new Date('2024-06-15T01:00:00Z'),
      brand_id: 2,
      brand_name: 'Mega Coffee',
    },
  ];

  describe('Weekly Context', () => {
    it('should calculate 7 weekly ranges ending with current week', () => {
      const context = createIntakeTrendContext(anchor, 'weekly');
      expect(context.chartRanges).toHaveLength(7);
      expect(context.daysInPeriod).toBe(7);

      const lastRange = context.chartRanges[6];
      expect(lastRange.start.format('YYYY-MM-DD')).toBe('2024-06-10'); // Monday
      expect(lastRange.end.format('YYYY-MM-DD')).toBe('2024-06-16'); // Sunday
    });
  });

  describe('Monthly Context', () => {
    it('should calculate 7 monthly ranges ending with current month', () => {
      const context = createIntakeTrendContext(anchor, 'monthly');
      expect(context.chartRanges).toHaveLength(7);
      expect(context.daysInPeriod).toBe(30); // June has 30 days

      const lastRange = context.chartRanges[6];
      expect(lastRange.start.format('YYYY-MM')).toBe('2024-06');
    });
  });

  describe('Aggregation Logic', () => {
    it('should correctly aggregate metrics, thresholds, and rankings', () => {
      const context = createIntakeTrendContext(anchor, 'weekly');

      const currentIntakes = mockIntakes.filter((i) => {
        const d = DateUtil.toKst(i.created_at);
        return (
          (d.isAfter(context.currentRange.start) ||
            d.isSame(context.currentRange.start)) &&
          (d.isBefore(context.currentRange.end) ||
            d.isSame(context.currentRange.end))
        );
      });

      const builder = new IntakeTrendBuilder(
        context,
        currentIntakes,
        mockIntakes,
      );

      const result = builder
        .buildChart()
        .buildMetrics()
        .buildThresholds()
        .buildRankings()
        .getResult();

      // Metrics: Current week has id 1, 2 and 3
      expect(result.metrics.sum).toBe(3);
      expect(result.metrics.totalDays).toBe(2); // 06-15 and 06-16
      // Daily Average: 3 cups / 7 days = 0.4285... -> standard round to 1 decimal: 0.4
      expect(result.metrics.dailyAverage).toBe(0.4);

      // Thresholds:
      // 2024-06-16 has 450mg (Excessive)
      // 2024-06-15 has 100mg (Moderate)
      expect(result.threshold.excessiveCount).toBe(1);
      expect(result.threshold.moderateCount).toBe(1);

      // Rankings
      expect(result.ranking[0].brand).toBe('Starbucks');
      expect(result.ranking[0].cups).toBe(2);
    });

    it('should respect the moderate condition (<= 400)', () => {
      const context = createIntakeTrendContext(anchor, 'weekly');
      const singleIntake = [
        {
          id: 1,
          caffeine: 400,
          created_at: new Date('2024-06-16T10:00:00Z'),
          brand_id: 1,
          brand_name: 'Starbucks',
        },
      ];
      const builder = new IntakeTrendBuilder(
        context,
        singleIntake,
        singleIntake,
      );

      const result = builder.buildThresholds().getResult();
      expect(result.threshold.excessiveCount).toBe(0);
      expect(result.threshold.moderateCount).toBe(1);
    });
  });
});
