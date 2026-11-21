import { Link2 } from "lucide-solid";

export const wishLabelClass =
  "mt-[17px] mb-1.5 block text-[12px] font-semibold text-[#43564c]";

const inputClass =
  "input h-[43px] w-full bg-white text-[13px] text-[#35483e] placeholder:text-[#9aa39b] focus:outline-none focus:border-[#779083] focus:shadow-[0_0_0_3px_#355a4a17]";

/**
 * The shared name + link fields, used by the create form and the edit dialog.
 * `idPrefix` keeps their ids unique when both are mounted.
 */
export default function WishFields(props: {
  idPrefix: string;
  name?: string | undefined;
  link?: string | undefined;
}) {
  return (
    <>
      <label class={wishLabelClass} for={`${props.idPrefix}-name`}>
        What are you wishing for?
      </label>
      <input
        id={`${props.idPrefix}-name`}
        name="name"
        type="text"
        class={inputClass}
        placeholder="e.g. A really good book"
        value={props.name ?? ""}
        maxlength="120"
        required
      />

      <label class={wishLabelClass} for={`${props.idPrefix}-link`}>
        Gift link
      </label>
      <label class="input flex h-[43px] w-full items-center gap-2 bg-white px-3 text-[13px] text-[#35483e] focus-within:outline-none focus-within:border-[#779083] focus-within:shadow-[0_0_0_3px_#355a4a17]">
        <Link2 size={16} aria-hidden="true" class="shrink-0 text-[#98a19a]" />
        <input
          id={`${props.idPrefix}-link`}
          name="link"
          type="url"
          class="grow bg-transparent text-[13px] text-[#35483e] placeholder:text-[#9aa39b] focus:outline-none"
          placeholder="https://..."
          inputmode="url"
          value={props.link ?? ""}
          maxlength="2000"
          required
        />
      </label>
      <p class="mt-1.5 mb-5 text-[10px] text-[#989c95]">
        Add a link to help your gift-giver find it.
      </p>
    </>
  );
}
