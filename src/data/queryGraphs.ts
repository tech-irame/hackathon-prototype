// Graphs that have been generated in chat sessions for each query.
// Surfaced in the QueryCard's "Add Graph" modal — user picks one to attach
// to the card. Renders via the project's canonical ConfigurableChart so the
// look matches chat + dashboard exactly. Reports lock down editing; that's
// the only difference vs the dashboard rendering.

export type QueryGraph = {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'area';
  xAxis: string;
  yAxis?: string;
  color?: string;
};

export const QUERY_GRAPHS: Record<string, QueryGraph[]> = {
  Q01: [
    { id: 'q01-g1', title: 'Duplicates by vendor', type: 'pie', xAxis: 'Vendor Name' },
    { id: 'q01-g2', title: 'Duplicate detection trend', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Count' },
    { id: 'q01-g3', title: 'Resolution status', type: 'pie', xAxis: 'Status' },
    { id: 'q01-g4', title: 'Cumulative duplicates', type: 'area', xAxis: 'Month', yAxis: 'Duplicate Count' },
  ],
  Q02: [
    { id: 'q02-g1', title: 'Changes by department', type: 'bar', xAxis: 'Department' },
    { id: 'q02-g2', title: 'Authorization status', type: 'pie', xAxis: 'Status' },
    { id: 'q02-g3', title: 'Changes over time', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Count' },
  ],
  RA01: [
    { id: 'ra01-g1', title: 'Risks by process area', type: 'pie', xAxis: 'Department' },
    { id: 'ra01-g2', title: 'Risk count by region', type: 'bar', xAxis: 'Region' },
  ],
  RA02: [
    { id: 'ra02-g1', title: 'Mitigation effectiveness', type: 'pie', xAxis: 'Status' },
    { id: 'ra02-g2', title: 'Strategies reviewed by quarter', type: 'bar', xAxis: 'Quarter' },
  ],
  CE01: [
    { id: 'ce01-g1', title: 'Controls tested by department', type: 'bar', xAxis: 'Department' },
    { id: 'ce01-g2', title: 'Effectiveness trend', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Score (%)' },
    { id: 'ce01-g3', title: 'Coverage by control family', type: 'pie', xAxis: 'Category' },
  ],
  WA01: [
    { id: 'wa01-g1', title: 'Workflow accuracy trend', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Score (%)' },
    { id: 'wa01-g2', title: 'Runs per workflow', type: 'bar', xAxis: 'Quarter' },
  ],
  WA02: [
    { id: 'wa02-g1', title: 'Exception resolution path', type: 'pie', xAxis: 'Status' },
    { id: 'wa02-g2', title: 'Daily exception count', type: 'area', xAxis: 'Week', yAxis: 'Duplicate Count' },
  ],
  EX01: [
    { id: 'ex01-g1', title: 'Compliance score trend', type: 'line', xAxis: 'Quarter', yAxis: 'Duplicate Score (%)' },
    { id: 'ex01-g2', title: 'Risk exposure by region', type: 'bar', xAxis: 'Region' },
    { id: 'ex01-g3', title: 'Material weakness status', type: 'pie', xAxis: 'Status' },
  ],
};
