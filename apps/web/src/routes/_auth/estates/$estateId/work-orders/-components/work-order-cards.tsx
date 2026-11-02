import { Badge } from "@proj/ui/components/badge";
import { Card, CardContent, CardHeader } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import type { WorkOrder } from "@/lib/work-orders";

export function WorkOrderCards({
  estateId,
  orders,
  loading,
}: {
  estateId: string;
  orders: WorkOrder[];
  loading: boolean;
}) {
  return (
    <ul
      aria-busy={loading}
      aria-label="Work orders"
      className="grid min-w-0 gap-3"
    >
      {orders.map((order) => (
        <li className="min-w-0" key={order.id}>
          <Card
            className="min-w-0 rounded-xl [overflow-wrap:anywhere]"
            size="sm"
          >
            <CardHeader className="gap-2">
              <h2 className="font-semibold text-sm">
                <Link
                  className="underline underline-offset-4"
                  params={{ estateId, workOrderId: order.id }}
                  to="/estates/$estateId/work-orders/$workOrderId"
                >
                  {order.reference}
                </Link>
              </h2>
              <p className="whitespace-pre-wrap">{order.description}</p>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="mb-1 text-muted-foreground">Priority</dt>
                  <dd>
                    <Badge
                      variant={
                        order.priority === "URGENT" ? "destructive" : "outline"
                      }
                    >
                      {order.priority}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-muted-foreground">Status</dt>
                  <dd>{order.status.replaceAll("_", " ")}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{order.category.replaceAll("_", " ")}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>
                    <time dateTime={order.createdAt}>
                      {new Date(order.createdAt).toLocaleString()}
                    </time>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
