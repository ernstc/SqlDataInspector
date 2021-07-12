import { DatabaseColumnValue } from './database-columnValue.model';
import { DatabaseTable } from "./database-table.model";
import { DatabaseColumn } from "./database-column.model";
import { DatabaseTableRow } from './database-table-row.model';


export class ViewModel {
    databaseName?: string;
    tables?: DatabaseTable[];
    columns?: DatabaseColumn[];
    values?: DatabaseColumnValue[];
    rows?: DatabaseTableRow[];
    rowsCount?: number;
    rowsColumnsName?: string[];
    filter?: string;
    autoApply?: boolean;
    showRecordDetails?: boolean;

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

    get selectedValue(): string | undefined {
        if (this.values != undefined && this.selectedValueIndex != undefined) {
            return this.values[this.selectedValueIndex].Value;
        }
        else {
            return undefined;
        }
    }

    get selectedRow(): DatabaseTableRow | undefined {
        if (this.rows != undefined && this.selectedRowRowIndex != undefined) {
            return this.rows[this.selectedRowRowIndex];
        }
        else {
            return undefined;
        }
    }

}