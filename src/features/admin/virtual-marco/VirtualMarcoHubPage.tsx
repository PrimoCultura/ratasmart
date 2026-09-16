import { Link } from "react-router-dom";
import { BookOpen, Bot, Brain, MessagesSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    to: "/admin/virtual-marco/intelligence",
    title: "Intelligence",
    description:
      "Temi, coverage, knowledge issues e segnali formativi (candidati).",
    icon: Brain,
  },
  {
    to: "/admin/virtual-marco/configurazione",
    title: "Configurazione",
    description: "Prompt di comportamento, modello e versioni dell’assistente.",
    icon: Bot,
  },
  {
    to: "/admin/virtual-marco/conoscenza",
    title: "Base di conoscenza",
    description: "Schede operative, alert, FAQ e procedure non strutturate.",
    icon: BookOpen,
  },
  {
    to: "/admin/virtual-marco/anteprima",
    title: "Anteprima contesto",
    description: "Testa la selezione deterministica senza chiamare OpenAI.",
    icon: Search,
  },
  {
    to: "/admin/virtual-marco/conversazioni",
    title: "Conversazioni",
    description: "Consultazione sola lettura di chat CM, token e gap.",
    icon: MessagesSquare,
  },
];

export function VirtualMarcoHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Virtual Marco"
        description="Configurazione, knowledge base e chat contestuale (Fase 4B)."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.to}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <section.icon className="h-4 w-4" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {section.description}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to={section.to}>Apri</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
