# SQL Data Inspector

![GitHub All Releases](https://img.shields.io/github/downloads/ernstc/SqlDataInspector/total)

This extension makes it easy to inspect data with just a few clicks.

Please leave a ⭐ as motivation if this tool is helpful for you!

![Example of dashboard](https://raw.githubusercontent.com/ernstc/SqlDataInspector/main/images/screen-071.png)

## Features

* Start inspecting a configured database or a selected object from the query editor.
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
* Support for **Microsoft SQL Server**, **MySQL**, and **PostgreSQL** through SQLTools.

### Connection management

SQL Data Inspector uses [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) for connection management and query execution. Configure connections in the SQLTools connection explorer and use the **SQLTools Driver Credentials** password mode to keep passwords out of VS Code settings. SQL Data Inspector stores no database credentials.

Install the SQLTools driver for each database engine you use:

* `mtxr.sqltools-driver-mssql`
* `mtxr.sqltools-driver-pg`
* `mtxr.sqltools-driver-mysql`

### Inspecting a database

1. Run **SQL Data Inspector: Inspect Database** from the Command Palette.
2. Select a SQLTools connection.
3. SQL Data Inspector opens the data inspector for that connection's database.

![Example of dashboard](https://raw.githubusercontent.com/ernstc/SqlDataInspector/main/images/screen-074.png)

### Inspecting data from the query editor

1. Select the table name or fully qualified table name in a SQL editor.
2. Right-click the selection.
3. Select **Inspect Selected Data**.
4. Select a SQLTools connection. The inspector opens with the selected table.

![Example of dashboard](https://raw.githubusercontent.com/ernstc/SqlDataInspector/main/images/screen-073.png)

### Extension settings

This extension has the some custom settings that let the user to customize the extension behaviour:

* Order columns alphabetically in the columns and the data inspector views.
* Shows primary key columns first in the columns and the data inspector views.
* Default refresh interval in seconds for the live monitoring view.
* The number of rows to show in the data inspector view.
* Show tables in the objects list.
* Show views in the objects list.
* Trace SQL commands and their results in **Output: SQL Data Inspector**. Disable `sqlDataInspector.tracing.sqlCommands` to prevent query text and returned data from being logged.



## Installation

The current release will be available through the Visual Studio Marketplace for Visual Studio Code.

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
