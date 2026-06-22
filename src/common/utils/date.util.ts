import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export class DateUtil {
  private static readonly KST_OFFSET = 9;

  /**
   * Returns current time adjusted to "Fake KST" (+9h)
   */
  static nowKst(): dayjs.Dayjs {
    return dayjs.utc().add(this.KST_OFFSET, 'hour');
  }

  /**
   * Converts a given date to "Fake KST" (+9h)
   */
  static toKst(date: Date | string | dayjs.Dayjs): dayjs.Dayjs {
    return dayjs.utc(date).add(this.KST_OFFSET, 'hour');
  }

  /**
   * Converts a "Fake KST" date back to UTC (-9h) for database storage
   */
  static toUtc(date: Date | string | dayjs.Dayjs): dayjs.Dayjs {
    return dayjs.utc(date).subtract(this.KST_OFFSET, 'hour');
  }

  /**
   * Formats a date for MySQL (YYYY-MM-DD HH:mm:ss)
   */
  static formatForDb(date: Date | dayjs.Dayjs): string {
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Gets the start and end of a day in KST
   */
  static getDayRange(date: dayjs.Dayjs) {
    return {
      start: date.startOf('day'),
      end: date.endOf('day'),
    };
  }

  /**
   * Gets the month key (YYYY-MM) for caching
   */
  static getMonthKey(date: dayjs.Dayjs): string {
    return date.format('YYYY-MM');
  }

  /**
   * Gets the day key (YYYY-MM-DD) for caching
   */
  static getDayKey(date: dayjs.Dayjs): string {
    return date.format('YYYY-MM-DD');
  }
}
