-- ✦ KRYVANTA ✦ — защита целостности финансовых данных на уровне БД

-- 1. Журналы только на добавление: audit_logs, payout_history, vip_grant_history
CREATE OR REPLACE FUNCTION kry_forbid_modify() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only (% is forbidden)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION kry_forbid_modify();
CREATE TRIGGER payout_history_append_only BEFORE UPDATE OR DELETE ON payout_history
  FOR EACH ROW EXECUTE FUNCTION kry_forbid_modify();
CREATE TRIGGER vip_grant_history_append_only BEFORE UPDATE OR DELETE ON vip_grant_history
  FOR EACH ROW EXECUTE FUNCTION kry_forbid_modify();

-- 2. Завершённые выплаты (PAID/REJECTED) нельзя изменить или удалить
CREATE OR REPLACE FUNCTION kry_payout_final() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('PAID', 'REJECTED') THEN
    RAISE EXCEPTION 'Payout % is final (%), it cannot be modified', OLD.id, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payout requests cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payout_requests_final BEFORE UPDATE OR DELETE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION kry_payout_final();

-- 3. Начисления: сумма, тип, база и ключ операции неизменяемы; удалять нельзя (только отмена статусом)
CREATE OR REPLACE FUNCTION kry_commission_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Commissions cannot be deleted, cancel them instead' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."amountKopecks" <> OLD."amountKopecks" OR NEW.type <> OLD.type
     OR NEW."operationKey" <> OLD."operationKey" OR NEW."creatorId" <> OLD."creatorId"
     OR NEW."baseKopecks" IS DISTINCT FROM OLD."baseKopecks" OR NEW."rateBps" IS DISTINCT FROM OLD."rateBps" THEN
    RAISE EXCEPTION 'Commission amounts are immutable, create an ADJUSTMENT instead' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Cancelled commission cannot be restored' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commissions_guard BEFORE UPDATE OR DELETE ON commissions
  FOR EACH ROW EXECUTE FUNCTION kry_commission_guard();

-- 4. Проверочные ограничения
ALTER TABLE purchases ADD CONSTRAINT purchases_amounts_chk
  CHECK ("basePriceKopecks" >= 0 AND "discountKopecks" >= 0 AND "amountKopecks" = "basePriceKopecks" - "discountKopecks");
ALTER TABLE payments ADD CONSTRAINT payments_amount_chk CHECK ("amountKopecks" > 0);
ALTER TABLE payout_requests ADD CONSTRAINT payout_amount_chk CHECK ("amountKopecks" > 0);
ALTER TABLE creator_codes ADD CONSTRAINT creator_codes_discount_chk CHECK ("discountBps" BETWEEN 0 AND 9000);
ALTER TABLE products ADD CONSTRAINT products_price_chk CHECK ("priceKopecks" > 0);
