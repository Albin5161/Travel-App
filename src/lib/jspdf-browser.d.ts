// jsPDF's browser build, imported by path: the package's "main" is its Node build, which Metro picks
// for the web too and can't bundle. Same library, same types.
declare module 'jspdf/dist/jspdf.es.min.js' {
  export * from 'jspdf';
}
