export interface DatabaseColumn {
    Name: string;
    Type: string;
    IsPrimaryKey: boolean,
    KeyOrdinal: number,
    HasForeignKey: boolean
}