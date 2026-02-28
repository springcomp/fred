import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PropertySheet } from './components/properties/PropertySheet';
import { SplitPane } from './components/SplitPane';
import { Toolbar } from './components/Toolbar';
import { SchemaTree } from './components/tree/SchemaTree';
import { parseXsd } from './model/parser';
import { untitledXsd } from './model/samples';
import { useEditorStore } from './store/editorStore';

export function App() {
  const schema = useEditorStore(s => s.schema);

  useEffect(() => {
    if (!schema) {
      try {
        useEditorStore.getState().loadSchema(parseXsd(untitledXsd));
      } catch (e) {
        console.error('Failed to load default schema:', e);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full">
        <Toolbar />
        <SplitPane left={<SchemaTree />} right={<PropertySheet />} defaultWidth={360} minWidth={200} maxWidth={600} />
      </div>
    </ErrorBoundary>
  );
}
