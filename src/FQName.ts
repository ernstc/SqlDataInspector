export class FQName {

    serverName?: string;
    databaseName?: string;
    schemaName?: string;
    tableName?: string;

    public constructor(fqname?: string) {
        if (typeof fqname !== "string") {
            return;
        }

        // Assume one of possible notations:
        // - server.database.schema.table
        // - database.schema.table
        // - schema.table
        // - table

        let split = fqname
            .replaceAll("[", "")
            .replaceAll("]", "")
            .split(".");

        if (split.length === 4) {
            this.serverName = split[0];
            this.databaseName = split[1];
            this.schemaName = split[2];
            this.tableName = split[3];
        }
        else if (split.length === 3) {
            this.databaseName = split[0];
            this.schemaName = split[1];
            this.tableName = split[2];
        }
        else if (split.length === 2) {
            this.schemaName = split[0];
            this.tableName = split[1];
        }
        else {
            this.tableName = split[0];
        }
    }

}