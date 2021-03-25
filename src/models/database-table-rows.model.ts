import { DatabaseTableRow } from './database-table-row.model';

export interface DatabaseTableRows {
    Columns: string[];
    Rows: DatabaseTableRow[];
}