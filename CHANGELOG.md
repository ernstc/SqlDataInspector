# Change Log

All notable changes to the "SQL Data Inspector" extension will be documented in this file.

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