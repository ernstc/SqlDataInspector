import { DatabaseColumn } from "./database-column.model";
import { DatabaseColumnValue } from './database-columnValue.model';
import { DatabaseInfo } from './database-info.model';
import { DatabaseObject } from "./database-object.model";
import { DatabaseTableRow } from './database-table-row.model';
import { FQName } from '../FQName';


export class ViewModel {
    serverName?: string;
    databaseName?: string;
    databaseInfo?: DatabaseInfo;
    objects?: DatabaseObject[];
    objectsSchema?: string[];
    columns?: DatabaseColumn[];
    values?: DatabaseColumnValue[];
    rows?: DatabaseTableRow[];
    rowsCount?: number;
    rowsColumnsName?: string[];
    rowsPageSize?: number;
    rowsPageIndex?: number;
    filter?: string;
    autoApply?: boolean;
    showRecordDetails?: boolean;
    liveMonitoring?: boolean;
    refreshTimer?: number;
    selectTables?: boolean;
    selectViews?: boolean;

    sortColumnNames?: string;

    sortAscendingColumnValues?: boolean;
    sortAscendingColumnValuesCount?: boolean;

    sortRowsByColumnName?: string;
    sortRowsByColumnAscending?: boolean;

    startWithObject?: FQName;
    selectedObjectIndex?: number;
    selectedColumnIndex?: number;
    selectedValueIndex?: number;
    selectedRowRowIndex?: number;
    selectedRowColumnIndex?: number;

    filterObjectsSchema?: string;
    searchObjectName?: string;
    filtersPanelOpen?: boolean;


    get selectedObject(): DatabaseObject | undefined {
        if (this.objects !== undefined && this.selectedObjectIndex !== undefined) {
            return this.objects[this.selectedObjectIndex];
        }
        else {
            return undefined;
        }
    }

    get selectedColumn(): DatabaseColumn | undefined {
        if (this.columns !== undefined && this.selectedColumnIndex !== undefined) {
            return this.columns[this.selectedColumnIndex];
        }
        else {
            return undefined;
        }
    }

    get selectedValue(): string | undefined {
        if (this.values !== undefined && this.selectedValueIndex !== undefined) {
            return this.values[this.selectedValueIndex].Value;
        }
        else {
            return undefined;
        }
    }

    get selectedRow(): DatabaseTableRow | undefined {
        if (this.rows !== undefined && this.selectedRowRowIndex !== undefined) {
            return this.rows[this.selectedRowRowIndex];
        }
        else {
            return undefined;
        }
    }

}