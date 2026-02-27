import { Toolbar } from "./components/Toolbar";
import { SchemaTree } from "./components/tree/SchemaTree";
import { PropertySheet } from "./components/properties/PropertySheet";

export function App() {
  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Tree panel */}
        <div className="w-[360px] min-w-[240px] border-r border-border overflow-auto">
          <SchemaTree />
        </div>
        {/* Property sheet panel */}
        <div className="flex-1 overflow-hidden">
          <PropertySheet />
        </div>
      </div>
    </div>
  );
}
