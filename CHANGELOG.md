# Change Log

All notable changes to the "SQL Data Inspector" extension will be documented in this file.

---

## January 2024 Release (version 0.7.2)

### New Features

* Added extension settings that will let the user to customize the extension behaviour.  
* Columns ordering can be changed from the extension settings. Until now the columns have been ordered alphabetically by default. From now on, the default ordering will be the ordinal ordering, but from the settings is possible to enable the alphabetical ordering. It is also possible to choose if the primary key columns must be shown as first columns. 
* Columns ordering can also be changed by clicking on the header of names column. This overrides the settings, but once enabled, can be disabled repeating the click on the header until the sorting icon disappears.
* The status of some controls is now persisted in the extension settings. The persisted controls are: `page size`, `show tables`, `show views`, `live monitoring refresh rate`. 

### Fixes

* Fixed behaviour when changing the page size when no object has already been selected. 

---

## October 2023 Release (version 0.7.1)

### Changes

* Added column information such as nullability (indicated with a question mark "?"), size and precision #19.
* Added new feature for copying all the values of the selected column and their corresponding counts. Copied values can be pasted on Excel for further analysis.
* The filters panel is now collapsible. This makes the usage of the workspace area more efficient when no filters are defined.
* Values for columns of type **date**, **datetime**, **datetime2** and **datetimeoffset** are sorted descending by default. This can be useful for monitoring columns with datetime for creations, updates and similar.

### Fixes

* Fixed a bug in the live monitoring that was preventing the data from refresh #18.

---

## September 2023 Release (version 0.7.0)

### Changes

* Added "**Inspect data**" menu item in the context menu of the editor. This menu item starts the extension showing immediately the object corresponding to the selected text in the editor #17. Thanks to @hjvdwijk.
* Added server name to header.
* Added selected table/view name to header.
* Improved visualization of `geography` and `geometry` columns #13.
* Implemented the filter by name on the list of tables/views #12.
* Improved performance during objects filtering avoiding to query the database for refreshing the list.
* Columns of type `binary|text|image|geography|geometry|variant|xml|json` now show the count of **NULL** and **NOT NULL** values in the "**Distinct Values**" section. Before this update no values where shown because these type of columns have not been considered for distinct values selection.
* Requires Azure Data Studio >= 1.45.0

### Fixes

* Fixed some theme color issues.
* Disabled ordering of columns of type `xml`.
* Updated dependecies with security warnings.
* Fixed ESLint warnings.
* Fixed markdownlint warnings.

---

## May 2022 Release (version 0.6.0)

### Changes

* Added visualization of Views #8.
* Added pagination in the rows data visualization.
* Added sorting by column in the table rows #5.
* Primary key columns are shown in bold

### Fixes

* Fixed vulnerabilities.
* Minor UI fixes

---

## February 2022 Release (version 0.5.0)

### Changes

* You can filter tables by schema.

### Fixes

* Fixed vulnerabilities.

---

## September 2021 Release (version 0.4.0)

### Changes

* Added rows count in the tables list.
* Added live monitoring mode for periodically refreshing the views.

### Fixes

* The list of tables does not shows anymore system tables like dbo.__RefactorLog.
* Fixed filtering on columns with numbers with decimal digits.

---

## July 2021 Release (version 0.3.0)

### Changes

* Distinct Values have a new column that shows the count of the value occurrences.
* The columns in the Distinct Values section can be sorted ascending or descending.

### Fixes

* Fixed a bug that caused opening the connection to the default database in case the connection is configured for connecting to a server and not to a specific database.
* Fixed loading indicator.
* Fixed filter columns with text.

---

## May 2021 Release (version 0.2.0)

### Changes

* The tool is now available from the Database or Server context menu using the menu item "Inspect data" and no more from the dashboard tab. This let to maximize the working area.

### Fixes

* When switching between panels and then going back to the inspect panel the page used to become completley blank. Now the view maintains its state.
* Fixed filtering on columns of type time, date, datetime2, datetimeoffset.

---

## April 2021 Release (version 0.1.1)

Bug fixing release

### Fixes

* Fixed visualization in dark mode.

### Features

* Added support to color themes.
* Improved visualization of column values.

---

## April 2021 Release (version 0.1.0)

Initial release

### Features

* Shows the list of tables of the database.
* Shows the list of columns of the selected table.
* Shows all the distinct values of the selected column.
* Shows a snapshot of the first 10 rows of the selected tables.
* A "Filter" section let you edit the WHERE clause that will be applied to each query that retrieves data.
* By double clicking on a distinct value, a filter on that value is automatically added in the "Filters" section.
* By double clicking on a row in the table snapshot, it shows a dialog with a detailed record of the row.
* Each selectable element can be copied with CTRL+C.
