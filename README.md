# SQL Data Inspector (MSSQL)

![GitHub All Releases](https://img.shields.io/github/downloads/ernstc/SqlDataInspector/total)

This Visual Studio Code extension makes it easy to inspect Microsoft SQL Server data with just a few clicks. It supports MSSQL connections through the [SQL Server (mssql)](https://marketplace.visualstudio.com/items?itemName=ms-mssql.mssql) extension.

Please leave a ⭐ as motivation if this tool is helpful for you!

![Example of dashboard](https://raw.githubusercontent.com/ernstc/SqlDataInspector/feat/vscode-extension-mssql/images/screen-mssql-1.0.0-1.png)

## Features

* Start inspecting a configured SQL Server database or a selected object from the SQL query editor.
* Shows the list of tables and views of the database.
* Shows the list of columns of the selected table or view.
* Shows all the distinct values of the selected column and their counts.
* Shows the rows of the selected table or view.
* You can filter objects by name and schema.
* You can edit the WHERE clause that will be applied to each query that retrieves data.
* By double clicking on a distinct value, a filter on that value is automatically added in the "Filters" section.
* By double clicking on a row in the table snapshot, a dialog is shown with all the record details.
* Live monitoring mode for periodically refreshing the views.
* Each selectable element can be copied with CTRL+C.
* All distinct values and counts for a column, can be copied in the clipboard. You can then paste the values in Excel for further analysis, for instance.
* Supports **Microsoft SQL Server (MSSQL)** exclusively.

### Connection management

SQL Data Inspector uses the SQL Server (mssql) extension for both connection management and query execution. Configure connections in its SQL Server Object Explorer. SQL Data Inspector stores no database credentials.

### Inspecting a database

1. In the SQL Server Object Explorer, right-click a connected server or database.
2. Select **Inspect Data**.
3. SQL Data Inspector opens the inspector for the selected SQL Server database.

Alternatively, run **Inspect Data** from the Command Palette and select a configured SQL Server connection that has a database already selected. The inspector opens with the selected database.

![Example of dashboard](https://raw.githubusercontent.com/ernstc/SqlDataInspector/feat/vscode-extension-mssql/images/screen-mssql-1.0.0-2.png)

### Inspecting data from the query editor

1. Select a table name or fully qualified table name in a SQL editor.
2. Right-click the selection.
3. Select **Inspect Selected Data**.
4. Select a configured SQL Server connection. The inspector opens with the selected table.

![Example of dashboard](https://raw.githubusercontent.com/ernstc/SqlDataInspector/feat/vscode-extension-mssql/images/screen-mssql-1.0.0-3.png)

### Extension settings

This extension has settings that customize its behavior:

* Order columns alphabetically in the columns and the data inspector views.
* Shows primary key columns first in the columns and the data inspector views.
* Default refresh interval in seconds for the live monitoring view.
* The number of rows to show in the data inspector view.
* Show tables in the objects list.
* Show views in the objects list.
* Trace SQL commands and their results in **Output: SQL Data Inspector**. Disabled by default to prevent query text and returned data from being logged.



## Installation

> **Compatibility note:** The latest version available for Azure Data Studio is **0.8.2**. Starting with version **1.0.0**, this extension is available only for Visual Studio Code.

The current release will be available through the Visual Studio Marketplace for Visual Studio Code. The SQL Server (mssql) extension is required and is installed automatically as an extension dependency.

Current and Pre-releases will be available from the [Releases](https://github.com/ernstc/SqlDataInspector/releases) tab of the projects repository.
Download the VSIX of the release you want and use the **Extensions: Install from VSIX...** command in Visual Studio Code.

## Change Log

See the [Change Log](./CHANGELOG.md) for the full changes.

## Bugs / New Features

If you find a bug or have an idea to improve this extension please create a new issue in this project.

## Contributing

You are more than welcome to help contribute to this project if you wish, please create a new fork of the main branch,
then submit a pull request to the main branch after making your changes.

## License

This project is released under the [MIT License](./LICENSE)
