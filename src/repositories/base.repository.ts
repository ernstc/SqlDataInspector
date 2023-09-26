import { connection, dataprotocol, DataProviderType, QueryProvider, SimpleExecuteResult } from "azdata";
import { Provider } from "../models/provider.enum";


export const runQuery = async <T>(provider: Provider, connectionId: string, query: string): Promise<T[]> => {
    try {
        const connectionUri = await connection.getUriForConnection(connectionId);
        const queryProvider: QueryProvider = dataprotocol.getProvider(provider, DataProviderType.QueryProvider);
        const result = await queryProvider.runQueryAndReturn(connectionUri, query);
        return mapResult(result) as T[];
    }
    catch (e: any) {
        console.error(e.message);
        return [] as T[];
    }
};


const mapResult = <T>(result: SimpleExecuteResult): T[] => result.rows.map(element => {
    const item: any = {};
    for (let columnIndex = 0; columnIndex < result.columnInfo.length; columnIndex++) {
        item[result.columnInfo[columnIndex].columnName] = undefinedOrValue(element[columnIndex].displayValue);
    }
    return item as T;
});

const undefinedOrValue = (value: string) => value !== 'NULL' ? value : undefined;