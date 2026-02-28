import { useEffect } from 'react';
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
      useEditorStore.getState().loadSchema(parseXsd(untitledXsd));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <SplitPane left={<SchemaTree />} right={<PropertySheet />} defaultWidth={360} minWidth={200} maxWidth={600} />
    </div>
  );
}
