"use client";

import { Tabs } from "@heroui/react";
import type { ReactNode } from "react";

export function SessionAdvancedTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  return <Tabs defaultSelectedKey={tabs[0].id}>
    <div className="session-advanced-tab-scroll">
      <Tabs.List aria-label="Avanserte øktfunksjoner">
        {tabs.map((tab) => <Tabs.Tab key={tab.id} id={tab.id}>{tab.label}<Tabs.Indicator /></Tabs.Tab>)}
      </Tabs.List>
    </div>
    {tabs.map((tab) => <Tabs.Panel key={tab.id} id={tab.id}>{tab.content}</Tabs.Panel>)}
  </Tabs>;
}
