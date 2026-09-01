import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/lib/constants/financial";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CompaniesPage() {
  const { userId } = useCurrentUser();
  const companies = useQuery(api.financialCompanies.getFinancialCompanyStats);
  const products = useQuery(api.financialProducts.listFinancialProductsWithStats);
  const createCompany = useMutation(api.financialCompanies.createFinancialCompany);
  const updateCompany = useMutation(api.financialCompanies.updateFinancialCompany);
  const setCompanyActive = useMutation(api.financialCompanies.setFinancialCompanyActive);
  const createProduct = useMutation(api.financialProducts.createFinancialProduct);
  const updateProduct = useMutation(api.financialProducts.updateFinancialProduct);
  const setProductActive = useMutation(api.financialProducts.setFinancialProductActive);
  const seedAgos = useMutation(api.seed.seedAgosPassDemo);

  const [editingCompanyId, setEditingCompanyId] = useState<Id<"financialCompanies"> | null>(
    null,
  );
  const [companyForm, setCompanyForm] = useState({
    name: "",
    shortName: "",
    description: "",
    isActive: true,
  });
  const [productForm, setProductForm] = useState({
    companyId: "" as string,
    name: "",
    code: "",
    category: "standard" as ProductCategory,
    description: "",
    isActive: true,
  });
  const [editingProductId, setEditingProductId] = useState<Id<"financialProducts"> | null>(
    null,
  );

  if (companies === undefined || products === undefined) {
    return <LoadingState />;
  }

  const resetCompanyForm = () => {
    setEditingCompanyId(null);
    setCompanyForm({ name: "", shortName: "", description: "", isActive: true });
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm({
      companyId: "",
      name: "",
      code: "",
      category: "standard",
      description: "",
      isActive: true,
    });
  };

  const saveCompany = async () => {
    if (!userId) return;
    try {
      if (editingCompanyId) {
        await updateCompany({
          actorUserId: userId,
          companyId: editingCompanyId,
          name: companyForm.name,
          shortName: companyForm.shortName,
          description: companyForm.description || undefined,
        });
        toast.success("Società aggiornata");
      } else {
        await createCompany({
          actorUserId: userId,
          ...companyForm,
          description: companyForm.description || undefined,
        });
        toast.success("Società creata");
      }
      resetCompanyForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio società");
    }
  };

  const saveProduct = async () => {
    if (!userId || !productForm.companyId) {
      toast.error("Seleziona una società");
      return;
    }
    try {
      if (editingProductId) {
        await updateProduct({
          actorUserId: userId,
          productId: editingProductId,
          name: productForm.name,
          code: productForm.code || undefined,
          category: productForm.category,
          description: productForm.description || undefined,
        });
        toast.success("Prodotto aggiornato");
      } else {
        await createProduct({
          actorUserId: userId,
          companyId: productForm.companyId as Id<"financialCompanies">,
          name: productForm.name,
          code: productForm.code || undefined,
          category: productForm.category,
          description: productForm.description || undefined,
          isActive: productForm.isActive,
        });
        toast.success("Prodotto creato");
      }
      resetProductForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio prodotto");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finanziarie e prodotti"
        description="Gestione società finanziarie e famiglie di prodotto per rete PCG/DES."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              if (!userId) return;
              try {
                const result = await seedAgos({ actorUserId: userId });
                toast.success(
                  result.tableCreated
                    ? "Seed Agos Pass demo creato"
                    : "Seed Agos Pass già presente",
                );
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Seed non riuscito",
                );
              }
            }}
          >
            Esegui seed Agos Pass
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {editingCompanyId ? "Modifica società" : "Nuova società"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={companyForm.name}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nome breve</Label>
              <Input
                value={companyForm.shortName}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, shortName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={companyForm.description}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            {!editingCompanyId ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={companyForm.isActive}
                  onCheckedChange={(checked) =>
                    setCompanyForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                Attiva
              </label>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={() => void saveCompany()}>Salva</Button>
              {editingCompanyId ? (
                <Button variant="outline" onClick={resetCompanyForm}>
                  Annulla
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {editingProductId ? "Modifica prodotto" : "Nuovo prodotto"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Società</Label>
              <Select
                value={productForm.companyId || undefined}
                onValueChange={(value) =>
                  setProductForm((prev) => ({ ...prev, companyId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona società" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company._id} value={company._id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={productForm.name}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Codice</Label>
              <Input
                value={productForm.code}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={productForm.category}
                onValueChange={(value) =>
                  setProductForm((prev) => ({
                    ...prev,
                    category: value as ProductCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {PRODUCT_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void saveProduct()}>Salva prodotto</Button>
              {editingProductId ? (
                <Button variant="outline" onClick={resetProductForm}>
                  Annulla
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Società</h2>
        {companies.length === 0 ? (
          <EmptyState
            title="Nessuna società"
            description="Crea una finanziaria oppure esegui il seed Agos Pass."
          />
        ) : (
          <div className="space-y-2">
            {companies.map((company) => (
              <div
                key={company._id}
                className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{company.name}</p>
                    <ActiveBadge active={company.isActive} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {company.shortName} · {company.productCount} prodotti ·{" "}
                    {company.tableCount} tabelle
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCompanyId(company._id);
                      setCompanyForm({
                        name: company.name,
                        shortName: company.shortName,
                        description: company.description ?? "",
                        isActive: company.isActive,
                      });
                    }}
                  >
                    Modifica
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        {company.isActive ? "Disattiva" : "Attiva"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {company.isActive ? "Disattivare" : "Attivare"} {company.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Lo stato influenzerà la visibilità delle relative tabelle attive
                          per i CM.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (!userId) return;
                            void setCompanyActive({
                              actorUserId: userId,
                              companyId: company._id,
                              isActive: !company.isActive,
                            })
                              .then(() => toast.success("Stato aggiornato"))
                              .catch((error: unknown) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Operazione non riuscita",
                                ),
                              );
                          }}
                        >
                          Conferma
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Prodotti</h2>
        {products.length === 0 ? (
          <EmptyState
            title="Nessun prodotto"
            description="Crea un prodotto collegato a una società."
          />
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product._id}
                className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{product.name}</p>
                    <ActiveBadge active={product.isActive} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {product.company?.name ?? "—"} ·{" "}
                    {PRODUCT_CATEGORY_LABELS[product.category]} ·{" "}
                    {product.code ?? "senza codice"} · {product.tableCount} tabelle
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingProductId(product._id);
                      setProductForm({
                        companyId: product.companyId,
                        name: product.name,
                        code: product.code ?? "",
                        category: product.category,
                        description: product.description ?? "",
                        isActive: product.isActive,
                      });
                    }}
                  >
                    Modifica
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!userId) return;
                      void setProductActive({
                        actorUserId: userId,
                        productId: product._id,
                        isActive: !product.isActive,
                      })
                        .then(() => toast.success("Stato prodotto aggiornato"))
                        .catch((error: unknown) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Operazione non riuscita",
                          ),
                        );
                    }}
                  >
                    {product.isActive ? "Disattiva" : "Attiva"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
