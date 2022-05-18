import { DatabaseTableRows } from './database-table-rows.model';
import { DatabaseColumn } from './database-column.model';
import { DatabaseObject } from "./database-object.model";

export interface Database {
    tables?: DatabaseObject[];
    columns?: DatabaseColumn[];
    values?: string[];
    rows?: DatabaseTableRows;
    errors: any[];
}