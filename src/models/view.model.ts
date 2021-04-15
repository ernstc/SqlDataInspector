import { DatabaseColumn } from "./database-column.model";
import { DatabaseTableRows } from "./database-table-rows.model";
import { DatabaseTable } from "./database-table.model";

export class ViewModel {
    databaseName?: string;
    tables?: DatabaseTable[];
    columns?: DatabaseColumn[];
    values?: string[];
    rows?: DatabaseTableRows[];
    rowsCount?: number;
    rowsHeader?: string[];
    filter?: string;
    autoApply?: boolean;

    selectedTableIndex?: number;
    selectedColumnIndex?: number;
    selectedValueIndex?: number;
    selectedRowRowIndex?: number;
    selectedRowColumnIndex?: number;

    get selectedTable(): DatabaseTable | undefined {
        if (this.tables != undefined && this.selectedTableIndex != undefined) {
            return this.tables[this.selectedTableIndex];
        }
        else {
            return undefined;
        }
    }

    get selectedColumn(): DatabaseColumn | undefined {
        if (this.columns != undefined && this.selectedColumnIndex != undefined) {
            return this.columns[this.selectedColumnIndex];
        }
        else {
            return undefined;
        }
    }

}