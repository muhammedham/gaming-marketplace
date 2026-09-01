import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  Gamepad2,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Tickets,
  Users,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, Navigate, NavLink, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  adminApi,
  type AdminCategory,
  type AdminGame,
  type AdminSection,
  type AdminSettings,
  type RecordStatus,
  type UserRole,
  type UserStatus,
} from "../features/admin/api";
import { Feedback, Pagination, StatusBadge } from "../features/orders/ui";

const sections: {
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "categories", label: "Categories", icon: Boxes },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "listings", label: "Listings", icon: ListChecks },
  { id: "orders", label: "Orders", icon: ClipboardCheck },
  { id: "withdrawals", label: "Withdrawals", icon: CircleDollarSign },
  { id: "support", label: "Support", icon: Tickets },
  { id: "settings", label: "Settings", icon: Settings },
];

const card = "rounded-xl border border-gray-200 bg-white";
const selectClass =
  "h-11 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const cell = "px-4 py-3 text-left text-sm align-top";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminNav({ current }: { current: AdminSection }) {
  return (
    <nav
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-1"
      aria-label="Admin sections"
    >
      {sections.map(({ id, label, icon: Icon }) => (
        <NavLink
          key={id}
          to={id === "dashboard" ? "/admin" : `/admin/${id}`}
          end={id === "dashboard"}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${current === id ? "bg-gray-950 text-white" : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-950"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={`${card} min-w-0 max-w-full overflow-hidden`}>
      <div className="w-full max-w-full overflow-x-auto">
        <table
          className="w-full min-w-[760px] border-collapse"
          aria-label={label}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

function Head({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

function MutationNotice({
  mutation,
}: {
  mutation: { isSuccess: boolean; error: Error | null };
}) {
  if (mutation.error) return <Feedback error={mutation.error} />;
  if (mutation.isSuccess)
    return (
      <p
        className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        role="status"
      >
        Saved successfully.
      </p>
    );
  return null;
}

function Filters({
  q,
  setQ,
  status,
  setStatus,
  options,
}: {
  q: string;
  setQ: (value: string) => void;
  status?: string;
  setStatus?: (value: string) => void;
  options?: string[];
}) {
  return (
    <div className={`${card} flex flex-col gap-3 p-4 sm:flex-row`}>
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search records…"
        aria-label="Search records"
      />
      {setStatus && options ? (
        <select
          className={`${selectClass} sm:w-56`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function DashboardView() {
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
    refetchInterval: 10_000,
  });
  if (query.isPending || query.isError || !query.data)
    return <Feedback pending={query.isPending} error={query.error} />;
  const data = query.data;
  const stats = [
    ["Users", data.counts.users, `${data.counts.suspendedUsers} suspended`],
    [
      "Active listings",
      data.counts.activeListings,
      `${data.counts.activeCategories} categories`,
    ],
    ["Orders", data.counts.orders, `${data.counts.openSupport} open support`],
    ["Withdrawals", data.counts.simulatedWithdrawals, "Simulation only"],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, detail]) => (
          <section className={`${card} p-5`} key={label}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{detail}</p>
          </section>
        ))}
      </div>
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <CircleDollarSign className="size-5 text-emerald-700" />
          <h2 className="font-semibold">Wallet integrity overview</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Available"
            value={`${data.balances.availableCoin} Coin`}
          />
          <Metric label="Held" value={`${data.balances.heldCoin} Coin`} />
          <Metric
            label="Simulated withdrawn"
            value={`${data.balances.simulatedWithdrawnCoin} Coin`}
          />
          <Metric
            label="Simulated net"
            value={`${data.balances.simulatedNetTry} TRY`}
          />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="font-semibold">Orders by status</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(data.ordersByStatus).map(([status, count]) => (
              <div className="rounded-lg bg-gray-50 p-3" key={status}>
                <StatusBadge status={status} />
                <p className="mt-2 text-2xl font-bold">{count}</p>
              </div>
            ))}
            {Object.keys(data.ordersByStatus).length === 0 ? (
              <p className="text-sm text-gray-500">No orders yet.</p>
            ) : null}
          </div>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="font-semibold">Recent admin audit</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {data.recentAudits.map((item) => (
              <div className="py-3 text-sm" key={item.id}>
                <p className="font-medium">{item.action}</p>
                <p className="text-gray-500">
                  {item.admin.name} · {item.entityType} ·{" "}
                  {dateLabel(item.createdAt)}
                </p>
              </div>
            ))}
            {!data.recentAudits.length ? (
              <p className="text-sm text-gray-500">
                No admin changes recorded yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
      <Table label="Recent wallet ledger">
        <thead>
          <tr>
            <Head>Sequence</Head>
            <Head>User</Head>
            <Head>Type</Head>
            <Head>Amount</Head>
            <Head>Description</Head>
            <Head>Time</Head>
          </tr>
        </thead>
        <tbody>
          {data.recentLedger.map((item) => (
            <tr className="border-b border-gray-100" key={item.id}>
              <td className={cell}>#{item.sequence}</td>
              <td className={cell}>
                <p className="font-medium">{item.user.name}</p>
                <p className="text-xs text-gray-500">{item.user.email}</p>
              </td>
              <td className={cell}>
                <StatusBadge status={item.type} />
              </td>
              <td className={cell}>{item.amount} Coin</td>
              <td className={cell}>{item.description}</td>
              <td className={cell}>{dateLabel(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function UsersView() {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "users", page, q, status],
    queryFn: () => adminApi.users({ page, q, status }),
  });
  const mutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { role?: UserRole; status?: UserStatus };
    }) => adminApi.updateUser(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  const change = (
    id: string,
    body: { role?: UserRole; status?: UserStatus },
  ) => {
    if (
      window.confirm(
        "Apply this account change? It is recorded in the Admin audit log.",
      )
    )
      mutation.mutate({ id, body });
  };
  return (
    <div className="space-y-4">
      <Filters
        q={q}
        setQ={(value) => {
          setQ(value);
          setPage(1);
        }}
        status={status}
        setStatus={(value) => {
          setStatus(value);
          setPage(1);
        }}
        options={["ACTIVE", "SUSPENDED"]}
      />
      <MutationNotice mutation={mutation} />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Admin users">
            <thead>
              <tr>
                <Head>User</Head>
                <Head>Role</Head>
                <Head>Status</Head>
                <Head>Wallet</Head>
                <Head>Activity</Head>
                <Head>Joined</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.email}</p>
                  </td>
                  <td className={cell}>
                    <select
                      className={selectClass}
                      value={item.role}
                      disabled={mutation.isPending}
                      onChange={(event) =>
                        change(item.id, {
                          role: event.target.value as UserRole,
                        })
                      }
                    >
                      {["BUYER", "SELLER", "ADMIN"].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className={cell}>
                    <select
                      className={selectClass}
                      value={item.status}
                      disabled={mutation.isPending}
                      onChange={(event) =>
                        change(item.id, {
                          status: event.target.value as UserStatus,
                        })
                      }
                    >
                      {["ACTIVE", "SUSPENDED"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </td>
                  <td className={cell}>
                    {item.wallet ? (
                      <>
                        <p>{item.wallet.availableBalance} available</p>
                        <p className="text-xs text-gray-500">
                          {item.wallet.heldBalance} held
                        </p>
                      </>
                    ) : (
                      "Missing"
                    )}
                  </td>
                  <td className={cell}>
                    {item._count.listings} listings · {item._count.purchases}{" "}
                    purchases · {item._count.sales} sales
                  </td>
                  <td className={cell}>{dateLabel(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function CategoriesView() {
  const client = useQueryClient();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [name, setName] = useState(""),
    [description, setDescription] = useState("");
  const query = useQuery({
    queryKey: ["admin", "categories", page, q, status],
    queryFn: () => adminApi.categories({ page, q, status }),
  });
  const create = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: () => {
      setName("");
      setDescription("");
      client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      adminApi.updateCategory(id, { status }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name, description });
  };
  return (
    <div className="space-y-4">
      <form
        className={`${card} grid gap-3 p-4 md:grid-cols-[1fr_2fr_auto]`}
        onSubmit={submit}
      >
        <Input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Category name"
        />
        <Input
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Category description"
        />
        <Button disabled={create.isPending}>Create category</Button>
      </form>
      <MutationNotice mutation={create} />
      <MutationNotice mutation={update} />
      <Filters
        q={q}
        setQ={(v) => {
          setQ(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={["ACTIVE", "INACTIVE"]}
      />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Admin categories">
            <thead>
              <tr>
                <Head>Category</Head>
                <Head>Description</Head>
                <Head>Listings</Head>
                <Head>Status</Head>
                <Head>Action</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item: AdminCategory) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">/{item.slug}</p>
                  </td>
                  <td className={cell}>{item.description}</td>
                  <td className={cell}>{item._count.listings}</td>
                  <td className={cell}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={cell}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={update.isPending}
                      onClick={() => {
                        const next =
                          item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                        if (
                          window.confirm(
                            next === "INACTIVE"
                              ? "Deactivate this category and hide its active listings?"
                              : "Activate this category? Listings remain manually controlled.",
                          )
                        )
                          update.mutate({ id: item.id, status: next });
                      }}
                    >
                      {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function GamesView() {
  const client = useQueryClient();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [name, setName] = useState("");
  const query = useQuery({
    queryKey: ["admin", "games", page, q, status],
    queryFn: () => adminApi.games({ page, q, status }),
  });
  const create = useMutation({
    mutationFn: adminApi.createGame,
    onSuccess: () => {
      setName("");
      client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      adminApi.updateGame(id, { status }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <div className="space-y-4">
      <form
        className={`${card} flex flex-col gap-3 p-4 sm:flex-row`}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ name });
        }}
      >
        <Input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Game name"
        />
        <Button disabled={create.isPending}>Create game</Button>
      </form>
      <MutationNotice mutation={create} />
      <MutationNotice mutation={update} />
      <Filters
        q={q}
        setQ={(v) => {
          setQ(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={["ACTIVE", "INACTIVE"]}
      />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Admin games">
            <thead>
              <tr>
                <Head>Game</Head>
                <Head>Listings</Head>
                <Head>Status</Head>
                <Head>Action</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item: AdminGame) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">/{item.slug}</p>
                  </td>
                  <td className={cell}>{item._count.listings}</td>
                  <td className={cell}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={cell}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={update.isPending}
                      onClick={() => {
                        const next =
                          item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                        if (
                          window.confirm(
                            next === "INACTIVE"
                              ? "Deactivate this game and hide its active listings?"
                              : "Activate this game?",
                          )
                        )
                          update.mutate({ id: item.id, status: next });
                      }}
                    >
                      {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function ListingsView() {
  const client = useQueryClient();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "listings", page, q, status],
    queryFn: () => adminApi.listings({ page, q, status }),
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) =>
      adminApi.updateListing(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <div className="space-y-4">
      <Filters
        q={q}
        setQ={(v) => {
          setQ(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={["ACTIVE", "INACTIVE"]}
      />
      <MutationNotice mutation={mutation} />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Admin listings">
            <thead>
              <tr>
                <Head>Listing</Head>
                <Head>Seller</Head>
                <Head>Taxonomy</Head>
                <Head>Media / Orders</Head>
                <Head>Status</Head>
                <Head>Action</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    <Link
                      className="font-medium text-emerald-700 hover:underline"
                      to={`/listings/${item.id}`}
                    >
                      {item.title}
                    </Link>
                    <p>{item.price} Coin</p>
                  </td>
                  <td className={cell}>
                    {item.seller.name}
                    <p className="text-xs text-gray-500">{item.seller.email}</p>
                  </td>
                  <td className={cell}>
                    {item.category.name}
                    <p className="text-xs text-gray-500">
                      {item.game?.name ?? "No game"}
                    </p>
                  </td>
                  <td className={cell}>
                    {item._count.media} / {item._count.orders}
                  </td>
                  <td className={cell}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={cell}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={mutation.isPending}
                      onClick={() => {
                        const next =
                          item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                        if (
                          window.confirm(
                            `${next === "ACTIVE" ? "Activate" : "Deactivate"} this listing?`,
                          )
                        )
                          mutation.mutate({ id: item.id, status: next });
                      }}
                    >
                      {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function OrdersView() {
  const client = useQueryClient();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "orders", page, q, status],
    queryFn: () => adminApi.orders({ page, q, status }),
  });
  const mutation = useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: "Complete" | "Cancel";
      note: string;
    }) => adminApi.orderAction(id, { action, note }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  const act = (id: string, action: "Complete" | "Cancel") => {
    const note = window.prompt(`${action} this order? Enter the audit reason:`);
    if (note?.trim()) mutation.mutate({ id, action, note });
  };
  return (
    <div className="space-y-4">
      <Filters
        q={q}
        setQ={(v) => {
          setQ(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          "WaitingDelivery",
          "WaitingConfirmation",
          "SupportPaused",
          "Completed",
          "Cancelled",
        ]}
      />
      <MutationNotice mutation={mutation} />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Admin orders">
            <thead>
              <tr>
                <Head>Order</Head>
                <Head>Buyer / Seller</Head>
                <Head>Amount</Head>
                <Head>Status</Head>
                <Head>Support</Head>
                <Head>Actions</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    <Link
                      className="font-medium text-emerald-700 hover:underline"
                      to={`/orders/${item.id}`}
                    >
                      {item.listingTitle}
                    </Link>
                    <p className="text-xs text-gray-500">{item.id}</p>
                  </td>
                  <td className={cell}>
                    <p>{item.buyer.name}</p>
                    <p className="text-xs text-gray-500">
                      to {item.seller.name}
                    </p>
                  </td>
                  <td className={cell}>{item.price} Coin</td>
                  <td className={cell}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={cell}>
                    {item.tickets.length
                      ? item.tickets.map((ticket) => (
                          <Link
                            className="block text-emerald-700 underline"
                            key={ticket.id}
                            to={`/support/${ticket.id}`}
                          >
                            {ticket.status}
                          </Link>
                        ))
                      : "—"}
                  </td>
                  <td className={`${cell} space-x-2`}>
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/orders/${item.id}`}>Inspect</Link>
                    </Button>
                    {item.status === "WaitingConfirmation" ? (
                      <Button
                        size="sm"
                        onClick={() => act(item.id, "Complete")}
                      >
                        Complete
                      </Button>
                    ) : null}
                    {["WaitingDelivery", "WaitingConfirmation"].includes(
                      item.status,
                    ) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => act(item.id, "Cancel")}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function WithdrawalsView() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "withdrawals", page, q],
    queryFn: () => adminApi.withdrawals({ page, q }),
  });
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Simulation only.</strong> These records never trigger a real
        payment or bank transfer.
      </div>
      <Filters
        q={q}
        setQ={(v) => {
          setQ(v);
          setPage(1);
        }}
      />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Simulated withdrawals">
            <thead>
              <tr>
                <Head>User</Head>
                <Head>Requested</Head>
                <Head>Fee</Head>
                <Head>Net simulation</Head>
                <Head>Bank preview</Head>
                <Head>Status</Head>
                <Head>Time</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    {item.wallet.user.name}
                    <p className="text-xs text-gray-500">
                      {item.wallet.user.email}
                    </p>
                  </td>
                  <td className={cell}>{item.amountCoin} Coin</td>
                  <td className={cell}>{item.feeCoin} Coin</td>
                  <td className={cell}>{item.netAmountTry} TRY</td>
                  <td className={cell}>
                    {item.accountHolderName}
                    <p className="text-xs text-gray-500">{item.ibanMasked}</p>
                  </td>
                  <td className={cell}>
                    <StatusBadge status={`${item.status} · SIMULATION`} />
                  </td>
                  <td className={cell}>{dateLabel(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function SupportView() {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "support", page, q, status],
    queryFn: () => adminApi.support({ page, q, status }),
  });
  return (
    <div className="space-y-4">
      <Filters
        q={q}
        setQ={(v) => {
          setQ(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={["Open", "InProgress", "Answered", "Closed"]}
      />
      <Feedback
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
      />
      {query.data?.items.length ? (
        <>
          <Table label="Admin support">
            <thead>
              <tr>
                <Head>Ticket</Head>
                <Head>User</Head>
                <Head>Order</Head>
                <Head>Status</Head>
                <Head>Messages</Head>
                <Head>Updated</Head>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr className="border-b border-gray-100" key={item.id}>
                  <td className={cell}>
                    <Link
                      className="font-medium text-emerald-700 hover:underline"
                      to={`/support/${item.id}`}
                    >
                      {item.subject}
                    </Link>
                  </td>
                  <td className={cell}>
                    {item.user.name}
                    <p className="text-xs text-gray-500">{item.user.email}</p>
                  </td>
                  <td className={cell}>
                    {item.order ? (
                      <>
                        <Link
                          className="text-emerald-700 underline"
                          to={`/orders/${item.order.id}`}
                        >
                          {item.order.listingTitle}
                        </Link>
                        <p>
                          <StatusBadge status={item.order.status} />
                        </p>
                      </>
                    ) : (
                      "General ticket"
                    )}
                  </td>
                  <td className={cell}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={cell}>{item._count.messages}</td>
                  <td className={cell}>{dateLabel(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination data={query.data} page={page} setPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function SettingsView() {
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.settings,
  });
  if (query.isPending || query.isError || !query.data)
    return <Feedback pending={query.isPending} error={query.error} />;
  return <SettingsForm key={query.data.updatedAt} initial={query.data} />;
}

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const client = useQueryClient();
  const [form, setForm] =
    useState<
      Pick<
        AdminSettings,
        "coinTryRate" | "withdrawalFeeRate" | "autoConfirmationHours"
      >
    >(initial);
  const mutation = useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Changes affect new simulated wallet operations and newly delivered
        orders. Existing order deadlines and ledger entries never change.
      </div>
      <form
        className={`${card} max-w-2xl space-y-5 p-6`}
        onSubmit={(event) => {
          event.preventDefault();
          if (
            window.confirm(
              "Save system settings and record this change in the audit log?",
            )
          )
            mutation.mutate(form);
        }}
      >
        <SettingField
          label="Coin / TRY rate"
          value={form.coinTryRate}
          onChange={(coinTryRate) => setForm({ ...form, coinTryRate })}
          step="0.000001"
        />
        <SettingField
          label="Withdrawal fee rate (0 to 1)"
          value={form.withdrawalFeeRate}
          onChange={(withdrawalFeeRate) =>
            setForm({ ...form, withdrawalFeeRate })
          }
          step="0.000001"
        />
        <SettingField
          label="Auto-confirmation hours"
          value={form.autoConfirmationHours}
          onChange={(autoConfirmationHours) =>
            setForm({ ...form, autoConfirmationHours })
          }
          step="0.0001"
        />
        <Button disabled={mutation.isPending}>Save settings</Button>
      </form>
      <MutationNotice mutation={mutation} />
    </div>
  );
}

function SettingField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input
        className="mt-1"
        type="number"
        required
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function AdminPage() {
  const { section: rawSection } = useParams<{ section?: string }>();
  const section = (rawSection ?? "dashboard") as AdminSection;
  if (!sections.some((item) => item.id === section))
    return <Navigate to="/admin" replace />;
  const content: Record<AdminSection, ReactNode> = {
    dashboard: <DashboardView />,
    users: <UsersView />,
    categories: <CategoriesView />,
    games: <GamesView />,
    listings: <ListingsView />,
    orders: <OrdersView />,
    withdrawals: <WithdrawalsView />,
    support: <SupportView />,
    settings: <SettingsView />,
  };
  return (
    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="size-4" />
            Admin control center
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {sections.find((item) => item.id === section)?.label}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Inspect marketplace records and perform audited management actions.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
          <Activity className="size-4 text-emerald-700" />
          Live operational data
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside>
          <AdminNav current={section} />
        </aside>
        <main className="min-w-0">{content[section]}</main>
      </div>
    </div>
  );
}
