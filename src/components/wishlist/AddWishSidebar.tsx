import type { CreateWishInput } from "../../lib/wishlist-api";
import AddWishPanel from "./AddWishPanel";
import type { WishlistSession } from "./useSession";

/** Desktop adapter: a sticky card in the second grid column. */
export default function AddWishSidebar(props: {
  session: WishlistSession;
  createWish: (input: CreateWishInput) => Promise<boolean>;
  turnstileSiteKey?: string | undefined;
}) {
  return (
    <div class="relative rounded-[14px] border border-[#e0ded3] bg-[#fffefb] px-8 pt-[58px] pb-8 shadow-[0_12px_35px_rgba(42,55,45,0.06)] before:pointer-events-none before:absolute before:inset-[5px] before:rounded-[10px] before:border before:border-[#f0eee6] before:content-['']">
      <AddWishPanel
        session={props.session}
        createWish={props.createWish}
        turnstileSiteKey={props.turnstileSiteKey}
      />
    </div>
  );
}
