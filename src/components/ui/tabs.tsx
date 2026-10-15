"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
export const Tabs = TabsPrimitive.Root;
export function TabsList(
  props: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
) {
  return <TabsPrimitive.List className="tabs-list" {...props} />;
}
export function TabsTrigger(
  props: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
) {
  return <TabsPrimitive.Trigger className="tab-trigger" {...props} />;
}
export const TabsContent = TabsPrimitive.Content;
