ALTER TABLE "orders" ADD CONSTRAINT "orders_positive_price" CHECK (price > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_distinct_parties" CHECK (buyer_id <> seller_id);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "messages" ADD CONSTRAINT "messages_one_context" CHECK ((conversation_id IS NOT NULL)::int + (ticket_id IS NOT NULL)::int = 1);
ALTER TABLE "messages" ADD CONSTRAINT "messages_nonempty" CHECK (length(trim(body)) > 0);
CREATE UNIQUE INDEX "support_tickets_one_active_order" ON "support_tickets" (order_id) WHERE order_id IS NOT NULL AND status <> 'Closed';
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_context" CHECK (
  (type IN ('DEPOSIT', 'WITHDRAWAL') AND order_id IS NULL) OR
  (type IN ('HOLD', 'RELEASE', 'SALE', 'REFUND') AND order_id IS NOT NULL)
);
