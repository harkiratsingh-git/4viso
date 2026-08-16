// Server-side .docx summary report generator (Part 3). Runs inside the Edge Function, never
// in the browser — the frontend only ever receives a signed download link once this has
// finished. Every number in the summary table comes straight from the `dashboard_summary`
// view (never recomputed here), exactly like every other part of this app.
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } from 'npm:docx@9';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// The live database was seeded independently of this app with a looser vocabulary than the
// UI's strict enums (see src/services/supabaseMappers.ts for the client-side equivalent of
// this same tolerance) — these mirror that normalization so the report never silently drops a
// lane just because its status string doesn't match an exact expected value.
function normalizedRiskLevel(row: any): 'Low' | 'Medium' | 'High' | 'Critical' {
  const v = String(row.risk_level || '');
  if (v === 'Low' || v === 'Medium' || v === 'High' || v === 'Critical') return v;
  const score = Number(row.risk_score) || 0;
  if (score >= 50) return 'Critical';
  if (score >= 35) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
}

function isActive(row: any): boolean {
  const v = String(row.status || '').toLowerCase();
  return v.includes('transit') || v.includes('active');
}

function isGdpCompliant(row: any): boolean {
  const v = String(row.gdp_status || '').toLowerCase();
  if (v.includes('non')) return false;
  if (v.includes('risk') || v.includes('warning')) return false;
  if (v.includes('compliant')) return true;
  return Number(row.gdp_compliance_rate) >= 92;
}

function headingRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
          shading: { fill: '1D9E75' },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })] })],
        })
    ),
  });
}

function dataRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
        })
    ),
  });
}

function laneTable(rows: any[], columns: string[] = ['Lane Code', 'Route', 'Carrier', 'Mode', 'Risk']): Table {
  if (rows.length === 0) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headingRow(columns), dataRow(['None', '', '', '', ''])],
    });
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headingRow(columns),
      ...rows.map((r) =>
        dataRow([
          String(r.lane_code || r.id),
          `${r.origin_iata || '?'} -> ${r.destination_iata || '?'}`,
          String(r.carrier || 'Unassigned'),
          String(r.mode || ''),
          `${normalizedRiskLevel(r)} (${Math.round(Number(r.risk_score) || 0)}%)`,
        ])
      ),
    ],
  });
}

export interface GeneratedReport {
  buffer: Uint8Array;
  filename: string;
}

export async function buildSummaryReportDocx(client: SupabaseClient): Promise<GeneratedReport> {
  const [{ data: lanes }, { data: summaryRows }, { data: alerts }] = await Promise.all([
    client.from('transport_lanes').select('*'),
    client.from('dashboard_summary').select('*').limit(1),
    client.from('alert_notifications').select('*'),
  ]);

  const allLanes = lanes || [];
  const summary = (summaryRows && summaryRows[0]) || null;
  const allAlerts = alerts || [];

  const activeLanes = allLanes.filter(isActive);
  const activeByRisk: Record<string, any[]> = { Critical: [], High: [], Medium: [], Low: [] };
  for (const lane of activeLanes) activeByRisk[normalizedRiskLevel(lane)].push(lane);

  const unresolvedExcursionLaneIds = new Set(
    allAlerts
      .filter((a: any) => !a.is_acknowledged && String(a.alert_type || '').toLowerCase().includes('temperature'))
      .map((a: any) => String(a.lane_id))
  );
  const atRiskLanes = allLanes.filter(
    (l: any) => normalizedRiskLevel(l) === 'High' || normalizedRiskLevel(l) === 'Critical' || unresolvedExcursionLaneIds.has(String(l.id))
  );

  // capa_records exists for full CAPA lifecycle tracking but is unpopulated in this
  // deployment's seed data, so "still open" is derived from the still-unacknowledged
  // capa_required alert on the lane instead — the same real signal the UI's CAPA badge uses.
  const openCapaLaneIds = new Set(
    allAlerts.filter((a: any) => a.capa_required && !a.is_acknowledged).map((a: any) => String(a.lane_id))
  );
  const documentationLanes = allLanes.filter((l: any) => openCapaLaneIds.has(String(l.id)) || !isGdpCompliant(l));

  const generatedAt = new Date();
  const summaryTable = summary
    ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headingRow(['Metric', 'Value']),
          dataRow(['Total Lanes', String(summary.total_lanes ?? '—')]),
          dataRow(['Active Lanes', String(summary.active_lanes ?? '—')]),
          dataRow(['High-Risk Lanes', String(summary.high_risk_lanes ?? '—')]),
          dataRow(['Avg GDP Compliance', `${summary.avg_gdp_compliance ?? '—'}%`]),
          dataRow(['Active Excursions', String(summary.active_excursions ?? '—')]),
          dataRow(['Payload In Transit (USD)', `$${Number(summary.payload_in_transit_usd || 0).toLocaleString()}`]),
          dataRow(['Unresolved Critical Alerts', String(summary.unresolved_critical_alerts ?? '—')]),
        ],
      })
    : new Paragraph({ children: [new TextRun({ text: 'dashboard_summary view was not reachable at generation time.', italics: true })] });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('PharmaTrack Cold-Chain Summary Report')] }),
          new Paragraph({
            children: [new TextRun({ text: `Generated ${generatedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`, italics: true, color: '666666' })],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Fleet Summary')] }),
          summaryTable,
          new Paragraph({ text: '' }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Active Lanes, by Risk Level')] }),
          ...(['Critical', 'High', 'Medium', 'Low'] as const).flatMap((level) => [
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${level} (${activeByRisk[level].length})`)] }),
            laneTable(activeByRisk[level]),
            new Paragraph({ text: '' }),
          ]),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`At-Risk Lanes (${atRiskLanes.length})`)] }),
          new Paragraph({ children: [new TextRun({ text: 'Risk level High/Critical, or an unresolved temperature excursion alert.', italics: true, size: 18 })] }),
          laneTable(atRiskLanes),
          new Paragraph({ text: '' }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Lanes Requiring Documentation (${documentationLanes.length})`)] }),
          new Paragraph({ children: [new TextRun({ text: 'An open CAPA requirement, or GDP status not Compliant.', italics: true, size: 18 })] }),
          laneTable(documentationLanes),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `pharmatrack-summary-${generatedAt.toISOString().replace(/[:.]/g, '-')}.docx`;
  return { buffer, filename };
}
