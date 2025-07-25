# qtl-site

## TODO
1. [DONE] Link to raw data
2. [DONE] Query by gene name. Output table.
3. [DONE] Query by rsid. Output table.
4. [DONE] Select queries for box plot.
5.
    a. [DONE] Receive IGK and IGL tables from Jacquelyn<br>
    b. Integrate tables into the website
6. Add manhattan plots
10. Properly label the plots
9. Add download link for plots
7. [BUG] First plot gets cut in half by second one
8. [BUG] CSVs should only be generated once download button is clicked. This results in expensive client-side calculations every search

supabase password: `oscarlr`


## HOW TO ADD TABLES:
### In code:
Change table `table_name` and duplicate one of these 
```html
<details>
    <summary>table_name</summary>
    <div class="table-panel" data-table="table_name"></div>
</details>
```
into
```html
<section id="accordions" style="margin-top:1em;">
```

### In supabase
1. Set columns `variant` and `gene` as primary keys. 
2. To prevent NO data being returned after a data query, disable RLS (Row-level security).
3. Supabase cannot always correctly infer the a table column's data data type, resulting in an error like this when uploading:

> Table K_L_guQTL_cleaned has been created but we ran into an error while inserting rows: invalid input syntax for type bigint: "170.0"
> Do check your spreadsheet if there are any discrepancies.

Use `pandas`'s `df.info()` function to check the columns' data types, and make the appropriate change.
In this case, three columns typed `int8` needed to change to `float8`.

It is safe to ignore the error `"" is an invalid value`. Try uploading again where it says `This table is empty.. Upload CSV`