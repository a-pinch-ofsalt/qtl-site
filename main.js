// main.js

import { createClient } from '@supabase/supabase-js';
import neo4j from 'neo4j-driver';
import NeoVis from 'neovis.js';
import Plotly from 'plotly.js-dist-min';

// 1) Supabase client
const supabase = createClient(
  'https://mwfhieyoqukgntpefijn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZmhpZXlvcXVrZ250cGVmaWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTU4NDUsImV4cCI6MjA2ODk3MTg0NX0.0ZLQjjO1AWibBhWZdueGmgbRv8QF_r7uyRmMExf2_tY'
);

// 2) Neo4j Driver for AuraDB (TLS enforced)
const driver = neo4j.driver(
  'neo4j://a2e305dc.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'GUiP24nrpAF4Ezc9XyfH1BYkCiyTYZ56O0Jb3TSK8bA'),
  {
    encrypted: 'ENCRYPTION_ON',
    trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES',
  }
);

// 3) Neovis.js graph visualization
const vizConfig = {
  containerId: 'neo4j-viz',
  neo4j: {
    serverUrl: 'neo4j://a2e305dc.databases.neo4j.io',
    serverUser: 'neo4j',
    serverPassword: 'GUiP24nrpAF4Ezc9XyfH1BYkCiyTYZ56O0Jb3TSK8bA',
    driverConfig: {
      encrypted: 'ENCRYPTION_ON',
      trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES',
    }
  },
  initialCypher: `
    MATCH (g:Gene)-[r]-(s:SNP)
    RETURN g, r, s
    LIMIT 25
  `,
  labels: {
    Gene: { caption: 'name' },
    SNP:  { caption: 'id'   }
  },
  relationships: {
    AFFECTED_BY: { caption: false, thickness: 1 },
    AFFECTS:     { caption: false, thickness: 1 }
  },
  visConfig: {
    layout: { improvedLayout: true },
    physics: {
      solver: 'forceAtlas2Based',
      stabilization: { enabled: true, iterations: 300 },
      forceAtlas2Based: {
        gravitationalConstant: -80,
        centralGravity: 0.01,
        springLength: 150,
        springConstant: 0.05
      }
    },
    edges: {
      arrows: { to: { enabled: true } },
      smooth: { enabled: true, type: 'curvedCW' }
    }
  }

};
const viz = new NeoVis(vizConfig);
viz.render();
window.viz = viz;  // expose for dynamic re-render

// 4) Cypher console: re-render graph on demand
const runBtn = document.getElementById('runCypher');
if (runBtn) {
  runBtn.addEventListener('click', () => {
    const stmt = document.getElementById('cypherInput')?.value.trim();
    if (stmt) viz.renderWithCypher(stmt);
  });
}

// 5) Plot & search logic
let plotCount = 0;
const plotsContainer = document.getElementById('plots');
const clearBtn = document.getElementById('clearPlots');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    plotsContainer.innerHTML = '';
    plotCount = 0;
  });
}

async function setupAutocomplete(inputId, listId, column) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  let last = '';
  if (!input || !list) return;
  input.addEventListener('input', async (e) => {
    const term = e.target.value.trim();
    if (term === last || term.length < 1) return;
    last = term;
    list.innerHTML = '';
    const tables = ['M_all_rank','G_all_rank','final_qtls_noIGKV1-13DEL','K_L_guQTL_cleaned'];
    const seen = new Set();
    await Promise.all(
      tables.map(async (tbl) => {
        const { data } = await supabase
          .from(tbl)
          .select(column)
          .ilike(column, `%${term}%`)
          .limit(10);
        data?.forEach((r) => {
          const val = r[column];
          if (val && !seen.has(val)) {
            seen.add(val);
            const opt = document.createElement('option');
            opt.value = val;
            list.appendChild(opt);
          }
        });
      })
    );
  });
}

setupAutocomplete('geneInput', 'gene-list', 'gene');
setupAutocomplete('snpInput', 'snp-list', 'variant');

document.getElementById('searchButton')?.addEventListener('click', onSearch);

async function onSearch() {
  const snp = document.getElementById('snpInput')?.value;
  const gene = document.getElementById('geneInput')?.value;
  const panels = document.querySelectorAll('.table-panel');

  for (const panel of panels) {
    const tableName = panel.dataset.table;
    let query = supabase.from(tableName).select('*');
    if (snp) query = query.eq('variant', snp);
    if (gene) query = query.eq('gene', gene);

    const { data, error } = await query;
    panel.innerHTML = '';
    const manHolder = panel.previousElementSibling;
    manHolder.innerHTML = '';

    if (error) {
      panel.innerText = `Error: ${error.message}`;
    } else if (!data?.length) {
      panel.innerText = 'No results found.';
    } else {
      // CSV download link
      const headers = Object.keys(data[0]);
      const rows = [headers.join(','),
        ...data.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))
      ];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const dl = document.createElement('a');
      dl.href = url;
      dl.download = `${tableName}.csv`;
      dl.innerText = 'Download CSV';
      dl.style.display = 'block';

      panel.appendChild(dl);
      panel.appendChild(buildTable(data));
      if (gene) await plotManhattan(tableName, gene, manHolder);
      else if (snp) await plotBySnp(tableName, snp, manHolder);
      panel.parentElement.open = true;
    }
  }
}

function buildTable(rows) {
  const table = document.createElement('table');
  table.border = 1;
  const hdr = table.insertRow();
  Object.keys(rows[0]).forEach((k) => {
    const th = document.createElement('th'); th.innerText = k; hdr.appendChild(th);
  });
  rows.forEach((r) => {
    const tr = table.insertRow();
    Object.entries(r).forEach(([k, v]) => {
      const td = tr.insertCell(); td.innerText = v;
      if (k === 'variant') {
        td.style.cursor = 'pointer';
        td.style.textDecoration = 'underline';
        td.onclick = () => showQtlPlot(r.variant, r.gene);
      }
    });
  });
  return table;
}

async function plotManhattan(table, gene, holder) {
  const { data } = await supabase.from(table).select('variant,pvalue').eq('gene', gene);
  if (!data?.length) return;
  const sorted = data.slice().sort((a, b) => a.variant.localeCompare(b.variant, undefined, { numeric: true }));
  const x = sorted.map((d) => d.variant);
  const y = sorted.map((d) => -Math.log10(d.pvalue));
  // const x = data.map((d) => d.variant);
  // const y = data.map((d) => -Math.log10(d.pvalue));
  const div = document.createElement('div');
  const id = `man-${table}-${plotCount++}`;
  div.id = id; div.style.cssText = 'width:100%;height:250px;';
  holder.appendChild(div);
  Plotly.newPlot(id, [{ x, y, type: 'scatter', mode: 'markers', marker: { line: { width: 1 }}}], {
    title: `–log₁₀(p) in ${table}`,
    xaxis: { type: 'category', tickangle: -45 },
    yaxis: { title: '–log₁₀(p)' }
  });
}

async function plotBySnp(table, snp, holder) {
  const { data } = await supabase.from(table).select('gene,pvalue').eq('variant', snp);
  if (!data?.length) return;
  const genes = data.map((d) => d.gene).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  const y = genes.map((g) => -Math.log10(data.find((d) => d.gene === g).pvalue));
  const div = document.createElement('div');
  const id = `snp-${table}-${plotCount++}`;
  div.id = id; div.style.cssText = 'width:100%;height:250px;';
  holder.appendChild(div);
  Plotly.newPlot(id, [{ x: genes, y, type: 'bar', marker: { line: { width: 1 }}}], {
    title: `–log₁₀(p) for SNP ${snp}`,
    xaxis: { type: 'category', categoryarray: genes, tickangle: -45 },
    yaxis: { title: '–log₁₀(p)' }
  });
}

async function showQtlPlot(variant, gene) {
  const { data: snpRow } = await supabase.from('qtl_data').select('*').eq('feature', variant).eq('type','snp').single();
  const { data: geneRow } = await supabase.from('qtl_data').select('*').eq('feature', gene).eq('type','gene').single();
  const samples = Object.keys(snpRow).filter((k) => !['feature','type'].includes(k));
  const byGen = {};
  samples.forEach((s) => {
    const g = snpRow[s], e = geneRow[s];
    (byGen[g] = byGen[g] || []).push(e);
  });
  const traces = Object.entries(byGen)
    .sort((a, b) => a[0] - b[0])
    .map(([g, v]) => ({ y: v, name: `Genotype ${g}`, type: 'box' }));
  const div = document.createElement('div');
  const id = `box-${plotCount++}`;
  div.id = id; div.style.cssText = 'width:100%;height:300px;';
  plotsContainer.appendChild(div);
  Plotly.newPlot(id, traces, {
    title: `${gene} expression by ${variant} genotype`,
    xaxis: { title: 'Genotype' },
    yaxis: { title: 'Expression' }
  });
}
