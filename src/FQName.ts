export class FQName {

    serverName: string;
    databaseName?: string;
    schemaName?: string;
    tableName?: string;

    public constructor(servername: string, fqname?: string) {
        this.serverName = servername;
        if (fqname === undefined) {
            return;
        }
        // assume database.schema.table notation with schema and table optional
        let split = fqname
            .replaceAll("[", "")
            .replaceAll("]", "")
            .split(".");
        this.databaseName = split[0];
        this.schemaName = split[1];
        this.tableName = split[2];
    }

}