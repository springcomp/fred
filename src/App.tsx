import { useEffect } from "react";
import { Toolbar } from "./components/Toolbar";
import { SplitPane } from "./components/SplitPane";
import { SchemaTree } from "./components/tree/SchemaTree";
import { PropertySheet } from "./components/properties/PropertySheet";
import { useEditorStore } from "./store/editorStore";
import { parseXsd } from "./model/parser";
import { untitledXsd } from "./model/samples";

export function App() {
  const schema = useEditorStore((s) => s.schema);

  useEffect(() => {
    if (!schema) {
      useEditorStore.getState().loadSchema(parseXsd(untitledXsd));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <SplitPane
        left={<SchemaTree />}
        right={<PropertySheet />}
        defaultWidth={360}
        minWidth={200}
        maxWidth={600}
      />
    </div>
  );
}
