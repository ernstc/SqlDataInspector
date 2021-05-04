# Change Log

All notable changes to the "SQL Data Inspector" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

---

## May 2021 Release (version 0.2.0)

### Changes

* The tool is now available from the Database or Server context menu using the menu item "Inspect data" and no more from the dashboard tab. This let to maximize the working area.

### Fixes

* When switching between panels and then going back to the inspect panel the page used to become completley blank. Now the view maintains its state.

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