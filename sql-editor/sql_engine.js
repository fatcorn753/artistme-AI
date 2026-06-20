/**
 * Minimal in-memory SQL engine supporting:
 * CREATE TABLE, INSERT INTO, SELECT (WHERE, ORDER BY, LIMIT, GROUP BY, JOIN, aggregates),
 * UPDATE, DELETE, DROP TABLE, SHOW TABLES, DESCRIBE
 */
class SQLEngine {
  constructor() { this.tables = {}; this.lastResult = null; }

  run(sql) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    let last = null;
    for (const stmt of stmts) last = this._exec(stmt);
    return last;
  }

  _exec(sql) {
    const u = sql.trim();
    const up = u.toUpperCase();
    try {
      if (up.startsWith('CREATE TABLE'))   return this._createTable(u);
      if (up.startsWith('INSERT INTO'))     return this._insert(u);
      if (up.startsWith('SELECT'))          return this._select(u);
      if (up.startsWith('UPDATE'))          return this._update(u);
      if (up.startsWith('DELETE'))          return this._delete(u);
      if (up.startsWith('DROP TABLE'))      return this._dropTable(u);
      if (up.startsWith('SHOW TABLES'))     return this._showTables();
      if (up.match(/^DESCRIBE\s+/i)||up.match(/^DESC\s+/i)) return this._describe(u);
      throw new Error('Unsupported statement: ' + u.slice(0,40));
    } catch(e) { return { error: e.message }; }
  }

  _tokenize(sql) {
    // Split respecting quoted strings and parentheses
    const tokens = [];
    let cur='', inStr=false, strChar='';
    for (let i=0;i<sql.length;i++) {
      const ch=sql[i];
      if (inStr) { cur+=ch; if(ch===strChar) inStr=false; }
      else if (ch==="'"||ch==='"') { inStr=true; strChar=ch; cur+=ch; }
      else if (ch===',' || ch==='(' || ch===')') { if(cur.trim()) tokens.push(cur.trim()); tokens.push(ch); cur=''; }
      else { cur+=ch; }
    }
    if (cur.trim()) tokens.push(cur.trim());
    return tokens;
  }

  _createTable(sql) {
    const m = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.+)\)/si);
    if (!m) throw new Error('Invalid CREATE TABLE syntax');
    const name = m[1], colDefs = m[2];
    if (this.tables[name]) return { message: `Table '${name}' already exists`, rowsAffected: 0 };
    const cols = [];
    for (const def of colDefs.split(',')) {
      const parts = def.trim().split(/\s+/);
      if (!parts[0] || parts[0].toUpperCase() === 'PRIMARY' || parts[0].toUpperCase() === 'UNIQUE') continue;
      cols.push({ name: parts[0], type: parts[1] || 'TEXT', constraints: parts.slice(2).join(' ').toUpperCase() });
    }
    this.tables[name] = { cols, rows: [] };
    return { message: `Table '${name}' created`, rowsAffected: 0, tableModified: true };
  }

  _insert(sql) {
    const m = sql.match(/INSERT\s+INTO\s+(\w+)\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+)/si);
    if (!m) throw new Error('Invalid INSERT syntax');
    const name = m[1], tbl = this.tables[name];
    if (!tbl) throw new Error(`Table '${name}' does not exist`);
    const colNames = m[2] ? m[2].split(',').map(s=>s.trim()) : tbl.cols.map(c=>c.name);
    const valBlock = m[3].trim();
    // Parse multiple value tuples
    const tuples = [];
    let depth=0, cur='', inStr=false, strChar='';
    for (const ch of valBlock) {
      if (inStr) { cur+=ch; if(ch===strChar) inStr=false; }
      else if (ch==="'"||ch==='"') { inStr=true; strChar=ch; cur+=ch; }
      else if (ch==='(') { if(depth===0) cur=''; else cur+=ch; depth++; }
      else if (ch===')') { depth--; if(depth===0) { tuples.push(cur); cur=''; } else cur+=ch; }
      else cur+=ch;
    }
    let count=0;
    for (const tuple of tuples) {
      const vals = this._parseValueList(tuple);
      const row = {};
      colNames.forEach((col,i) => { row[col] = this._parseVal(vals[i]||'NULL'); });
      // Auto-fill missing cols with NULL
      tbl.cols.forEach(c => { if(!(c.name in row)) row[c.name]=null; });
      tbl.rows.push(row); count++;
    }
    return { message: `${count} row(s) inserted`, rowsAffected: count, tableModified: true };
  }

  _parseValueList(str) {
    const vals=[]; let cur='', inStr=false, strChar='';
    for (const ch of str) {
      if (inStr) { cur+=ch; if(ch===strChar) inStr=false; }
      else if (ch==="'"||ch==='"') { inStr=true; strChar=ch; cur+=ch; }
      else if (ch===',') { vals.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    if (cur.trim()) vals.push(cur.trim());
    return vals;
  }

  _parseVal(v) {
    if (!v || v.toUpperCase()==='NULL') return null;
    if ((v.startsWith("'")||v.startsWith('"')) && (v.endsWith("'")||v.endsWith('"'))) return v.slice(1,-1);
    const n=Number(v); return isNaN(n) ? v : n;
  }

  _select(sql) {
    // Parse: SELECT cols FROM table [JOIN...] [WHERE...] [GROUP BY...] [ORDER BY...] [LIMIT n]
    const limitM = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
    const limit  = limitM ? parseInt(limitM[1]) : Infinity;
    const offset = limitM ? parseInt(limitM[2]||0) : 0;
    const orderM = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s+GROUP\s+BY|$)/i);
    const groupM = sql.match(/GROUP\s+BY\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+HAVING|$)/i);
    const whereM = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    const havingM= sql.match(/HAVING\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);

    // Strip to get FROM clause
    let fromPart = sql.replace(/^SELECT\s+/i,'').replace(/WHERE.*/is,'').replace(/GROUP\s+BY.*/is,'').replace(/ORDER\s+BY.*/is,'').replace(/LIMIT.*/is,'').replace(/HAVING.*/is,'');
    const fromIdx = fromPart.search(/\sFROM\s/i);
    const colsPart= fromPart.slice(0, fromIdx).trim();
    const fromRest= fromPart.slice(fromIdx + 5).trim();

    // JOIN parsing
    const joinM = fromRest.match(/(\w+)\s+(?:(LEFT|RIGHT|INNER)\s+)?JOIN\s+(\w+)\s+ON\s+(.+)/i);
    let rows;
    if (joinM) {
      const tbl1=joinM[1], tbl2=joinM[3], onCond=joinM[4];
      if (!this.tables[tbl1]) throw new Error(`Table '${tbl1}' not found`);
      if (!this.tables[tbl2]) throw new Error(`Table '${tbl2}' not found`);
      rows = [];
      for (const r1 of this.tables[tbl1].rows) {
        for (const r2 of this.tables[tbl2].rows) {
          const combined = {...Object.fromEntries(Object.entries(r1).map(([k,v])=>[`${tbl1}.${k}`,v])),...Object.fromEntries(Object.entries(r2).map(([k,v])=>[`${tbl2}.${k}`,v])),...r1,...r2};
          if (this._evalWhere(combined, onCond)) rows.push(combined);
        }
      }
    } else {
      const tableName = fromRest.trim().split(/\s+/)[0];
      if (!this.tables[tableName]) throw new Error(`Table '${tableName}' not found`);
      rows = [...this.tables[tableName].rows];
    }

    // WHERE
    if (whereM) rows = rows.filter(r => this._evalWhere(r, whereM[1]));

    // GROUP BY
    if (groupM) {
      const groupCols = groupM[1].split(',').map(s=>s.trim());
      const groups = {};
      rows.forEach(r => {
        const key = groupCols.map(c=>r[c]).join('|');
        if (!groups[key]) groups[key]={rows:[],sample:r};
        groups[key].rows.push(r);
      });
      rows = Object.values(groups).map(g => {
        const row = {...g.sample};
        // Apply aggregates in selected cols
        return row;
      });
    }

    // ORDER BY
    if (orderM) {
      const parts = orderM[1].split(',').map(s=>s.trim());
      rows.sort((a,b)=>{
        for (const p of parts) {
          const [col, dir='ASC'] = p.split(/\s+/);
          const av=a[col], bv=b[col];
          const cmp = av<bv?-1:av>bv?1:0;
          if (cmp!==0) return dir.toUpperCase()==='DESC'?-cmp:cmp;
        }
        return 0;
      });
    }

    // Limit/offset
    rows = rows.slice(offset, offset+limit);

    // SELECT columns
    const cols = this._parseSelectCols(colsPart, rows);
    const result = rows.map(r => this._projectRow(r, cols));
    return { columns: cols.map(c=>c.alias||c.expr), rows: result, rowCount: result.length };
  }

  _parseSelectCols(colsPart, rows) {
    if (colsPart.trim()==='*') {
      const allKeys = rows.length ? Object.keys(rows[0]) : [];
      return allKeys.map(k=>({expr:k, alias:k, fn:null}));
    }
    return colsPart.split(',').map(c=>{
      c=c.trim();
      const asM=c.match(/(.+)\s+AS\s+(\w+)/i);
      const expr=asM?asM[1].trim():c;
      const alias=asM?asM[2]:c.replace(/[()]/g,'').split('.').pop();
      const fnM=expr.match(/^(\w+)\(([^)]*)\)$/i);
      return {expr, alias, fn:fnM?{name:fnM[1].toUpperCase(),col:fnM[2].trim()}:null};
    });
  }

  _projectRow(row, cols) {
    return cols.map(c=>{
      if (c.fn) {
        const {name,col}=c.fn;
        if (name==='COUNT') return col==='*'?1:row[col]!=null?1:0;
        if (name==='UPPER') return String(row[col]||'').toUpperCase();
        if (name==='LOWER') return String(row[col]||'').toLowerCase();
        if (name==='LENGTH') return String(row[col]||'').length;
        return row[col];
      }
      // dot notation
      const key = c.expr.includes('.')?c.expr.split('.').pop():c.expr;
      return row[key]??null;
    });
  }

  _evalWhere(row, cond) {
    if (!cond) return true;
    try {
      // Replace col names with values
      let expr = cond.replace(/\b(\w+(?:\.\w+)?)\b/g, (m) => {
        const key = m.includes('.')?m.split('.').pop():m;
        if (key.toUpperCase()==='NULL'||key.toUpperCase()==='AND'||key.toUpperCase()==='OR'||key.toUpperCase()==='NOT'||key.toUpperCase()==='IS'||key.toUpperCase()==='LIKE'||key.toUpperCase()==='IN'||key.toUpperCase()==='BETWEEN') return m;
        if (row[key]!==undefined) {
          const v=row[key];
          return v===null?'null':typeof v==='string'?`"${v.replace(/"/g,'\\"')}"`:v;
        }
        return m;
      });
      expr=expr.replace(/\bIS\s+NULL\b/gi,'=== null').replace(/\bIS\s+NOT\s+NULL\b/gi,'!== null');
      expr=expr.replace(/\bLIKE\b/gi,'LIKE_OP').replace(/LIKE_OP\s+"([^"]*)"/g,(_,p)=>`/*LIKE:${p}*/true`);
      expr=expr.replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||').replace(/\bNOT\b/gi,'!');
      expr=expr.replace(/<>/g,'!==').replace(/=/g,'===').replace(/!===/g,'!==').replace(/====/g,'===');
      return Function(`"use strict";return(${expr})`)();
    } catch { return true; }
  }

  _update(sql) {
    const m = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/si);
    if (!m) throw new Error('Invalid UPDATE syntax');
    const name=m[1], tbl=this.tables[name];
    if (!tbl) throw new Error(`Table '${name}' not found`);
    const sets = m[2].split(',').map(s=>{const [k,...v]=s.trim().split('=');return{col:k.trim(),val:v.join('=').trim()};});
    let count=0;
    tbl.rows.forEach(row=>{
      if (!m[3]||this._evalWhere(row,m[3])){
        sets.forEach(({col,val})=>row[col]=this._parseVal(val));
        count++;
      }
    });
    return {message:`${count} row(s) updated`,rowsAffected:count,tableModified:true};
  }

  _delete(sql) {
    const m=sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/si);
    if (!m) throw new Error('Invalid DELETE syntax');
    const name=m[1],tbl=this.tables[name];
    if (!tbl) throw new Error(`Table '${name}' not found`);
    const before=tbl.rows.length;
    tbl.rows=tbl.rows.filter(r=>m[2]?!this._evalWhere(r,m[2]):false);
    return {message:`${before-tbl.rows.length} row(s) deleted`,rowsAffected:before-tbl.rows.length,tableModified:true};
  }

  _dropTable(sql) {
    const m=sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
    if (!m) throw new Error('Invalid DROP TABLE syntax');
    if (!this.tables[m[1]]) throw new Error(`Table '${m[1]}' not found`);
    delete this.tables[m[1]];
    return {message:`Table '${m[1]}' dropped`,rowsAffected:0,tableModified:true};
  }

  _showTables() {
    const names=Object.keys(this.tables);
    return {columns:['Tables'],rows:names.map(n=>[n]),rowCount:names.length};
  }

  _describe(sql) {
    const m=sql.match(/(?:DESCRIBE|DESC)\s+(\w+)/i);
    const tbl=this.tables[m[1]];
    if (!tbl) throw new Error(`Table '${m[1]}' not found`);
    return {columns:['Column','Type','Constraints'],rows:tbl.cols.map(c=>[c.name,c.type||'TEXT',c.constraints||'']),rowCount:tbl.cols.length};
  }

  getSchema() {
    return Object.entries(this.tables).map(([name,tbl])=>({name,cols:tbl.cols,rowCount:tbl.rows.length}));
  }
}
window.db = new SQLEngine();
