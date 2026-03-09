import { MysqlService } from '../../providers/mysql/mysql.service';

export abstract class BaseRepository {
  constructor(protected readonly mysql: MysqlService) {}

  protected buildUpdateQuery(
    table: string,
    dto: Record<string, any>,
    idField: string,
    idValue: any,
  ) {
    const params: any[] = [];
    const updates = Object.keys(dto)
      .filter((key) => dto[key] !== undefined)
      .map((key) => {
        params.push(dto[key]);
        return `${this.toSnake(key)} = ?`;
      });

    if (updates.length === 0) return null;

    const query = `
      UPDATE ${table} 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE ${idField} = ? AND deleted_at IS NULL
    `;
    params.push(idValue);

    return { query, params };
  }

  protected toSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
