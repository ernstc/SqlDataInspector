import { DatabaseTableRows } from './database-table-rows.model';
import { DatabaseColumn } from './database-column.model';
import { DatabaseTable } from "./database-table.model";

export interface Database {
    tables?: DatabaseTable[];
    columns?: DatabaseColumn[];
    values?: string[];
    rows?: DatabaseTableRows;
    errors: any[];
}