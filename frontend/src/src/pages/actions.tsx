//
// Actions: unified view for Tasks and Callbacks
//
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, PhoneCall } from "lucide-react";
import Tasks from "@/pages/tasks";
import Callbacks from "@/pages/callbacks";

type ActionsTab = "tasks" | "callbacks";

function getTabFromSearch(search: string): ActionsTab {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab === "callbacks" || tab === "tasks") return tab;
  return "tasks";
}

export default function Actions() {
  const [location, setLocation] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const [activeTab, setActiveTab] = useState<ActionsTab>(() => getTabFromSearch(search));

  // Sync tab from URL on mount, when location changes, and on browser back/forward
  useEffect(() => {
    setActiveTab(getTabFromSearch(typeof window !== "undefined" ? window.location.search : ""));
  }, [location]);

  useEffect(() => {
    const onPopState = () => {
      setActiveTab(getTabFromSearch(window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTabChange = (value: string) => {
    const tab = value as ActionsTab;
    setActiveTab(tab);
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("tab", tab);
    const newSearch = params.toString();
    setLocation(`${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`, { replace: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 mt-4 sm:mt-6 md:mt-8">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 h-11">
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            Callbacks
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-0">
          <Tasks />
        </TabsContent>
        <TabsContent value="callbacks" className="mt-0">
          <Callbacks />
        </TabsContent>
      </Tabs>
    </div>
  );
}
