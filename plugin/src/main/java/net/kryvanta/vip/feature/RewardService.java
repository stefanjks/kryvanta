package net.kryvanta.vip.feature;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.kryvanta.core.Text;
import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.data.PlayerData;
import net.kryvanta.vip.data.SyncState;
import net.kryvanta.vip.logic.WeightedPicker;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Material;
import org.bukkit.Sound;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Награды за игровое время: начисление, выдача и защита от дублирования. */
public final class RewardService {
    private final VipModule vip;
    private final SecureRandom random = new SecureRandom();

    public RewardService(VipModule vip) { this.vip = vip; }

    /** Начисление награды за накопленное время. Набор выбирается сразу (переоткрытие меню не меняет результат). */
    public void creditPlaytime(Player p, PlayerData d) {
        List<SyncState.RewardKit> pool = new ArrayList<>(vip.sync().rewards.values());
        SyncState.RewardKit kit = WeightedPicker.pick(pool, SyncState.RewardKit::weight, random);
        if (kit == null) return;
        d.credits.add(new PlayerData.Credit(UUID.randomUUID().toString(), kit.key(), "PLAYTIME"));
        if (d.rewardReminders) {
            Text.send(p, "<gold>✦ Доступна награда за игровое время: <white><kit></white>! <gray>Забрать: <yellow>/viprewards",
                    Placeholder.unparsed("kit", kit.nameRu()));
            p.playSound(p.getLocation(), Sound.ENTITY_PLAYER_LEVELUP, 0.6f, 1.4f);
        }
    }

    /** Награда, выданная администрацией или купленная на сайте (игрок может быть офлайн). */
    public void creditExternal(UUID uuid, String rewardKey, int count, String source) {
        vip.store().modify(uuid, d -> {
            for (int i = 0; i < Math.max(1, Math.min(10, count)); i++) {
                d.credits.add(new PlayerData.Credit(UUID.randomUUID().toString(), rewardKey, source));
            }
        });
    }

    public List<ItemStack> itemsOf(SyncState.RewardKit kit) {
        List<ItemStack> out = new ArrayList<>();
        for (SyncState.RewardItem ri : kit.items()) {
            Material m = Material.matchMaterial(ri.material());
            if (m == null || !m.isItem() || m.isAir()) continue;
            int left = ri.amount();
            while (left > 0) {
                int n = Math.min(left, m.getMaxStackSize());
                out.add(new ItemStack(m, n));
                left -= n;
            }
        }
        return out;
    }

    private static int freeSlots(PlayerInventory inv) {
        int free = 0;
        for (ItemStack s : inv.getStorageContents()) if (s == null || s.getType().isAir()) free++;
        return free;
    }

    /**
     * Выдача. Порядок защищает от дублирования: проверка места → удаление начисления → сохранение →
     * выдача предметов → запись в журнал сайта (с уникальным claimId).
     */
    public void claim(Player p, String creditId) {
        if (!p.isOnline()) return;
        PlayerData d = vip.store().get(p.getUniqueId());
        if (d == null) return;
        PlayerData.Credit credit = d.credits.stream().filter(c -> c.id().equals(creditId)).findFirst().orElse(null);
        if (credit == null) { Text.send(p, "<red>Награда уже получена."); return; }
        if ("PLAYTIME".equals(credit.source()) && !vip.isVip(p)) { Text.send(p, "<red>Награды за игровое время доступны только с KRYVANTA VIP."); return; }
        SyncState.RewardKit kit = vip.sync().rewards.get(credit.rewardKey());
        if (kit == null) { Text.send(p, "<red>Этот набор сейчас недоступен. Награда сохранена, попробуйте позже."); return; }
        List<ItemStack> items = itemsOf(kit);
        if (items.isEmpty()) { Text.send(p, "<red>Набор настроен неверно. Сообщите администрации."); return; }
        if (freeSlots(p.getInventory()) < items.size()) {
            Text.send(p, "<red>Освободите в инвентаре <white><n></white> слот(ов).", Placeholder.unparsed("n", String.valueOf(items.size())));
            return;
        }
        d.credits.remove(credit);
        vip.store().save(d);
        p.getInventory().addItem(items.toArray(new ItemStack[0]));
        p.playSound(p.getLocation(), Sound.ENTITY_PLAYER_LEVELUP, 0.8f, 1.2f);
        Text.send(p, "<green>✦ Вы получили: <white><kit>", Placeholder.unparsed("kit", kit.nameRu()));

        JsonObject claim = new JsonObject();
        claim.addProperty("claimId", credit.id());
        claim.addProperty("uuid", p.getUniqueId().toString());
        claim.addProperty("name", p.getName());
        claim.addProperty("rewardKey", kit.key());
        claim.addProperty("source", credit.source());
        claim.addProperty("claimedAt", Instant.now().toString());
        JsonArray arr = new JsonArray();
        for (SyncState.RewardItem ri : kit.items()) {
            JsonObject o = new JsonObject();
            o.addProperty("material", ri.material());
            o.addProperty("amount", ri.amount());
            arr.add(o);
        }
        claim.add("items", arr);
        JsonObject body = new JsonObject();
        JsonArray claims = new JsonArray();
        claims.add(claim);
        body.add("claims", claims);
        vip.outbox().add("/api/plugin/rewards", body);
        vip.plugin().getLogger().info("Награда " + kit.key() + " (" + credit.source() + ") выдана " + p.getName() + ", claim " + credit.id());
    }
}
