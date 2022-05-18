import { DatabaseObjectType } from "./database-objectType.model";

export interface DatabaseObject {
    Name: string;
    Schema: string;
    Count?: string;
    ObjectType: DatabaseObjectType;
}