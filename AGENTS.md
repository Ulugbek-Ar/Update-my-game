<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Game logic lives in src/game/* as plain TS classes (Game owns loop/state); React only mounts the canvas and menu — keeps per-frame state out of React renders.
- Character sprite frames are rasterized from code-defined poses in src/game/sprites.ts and selected by the existing Animator; visual dimensions stay independent of collision sizes to preserve combat balance.
- Keep viewport fitting in CSS and uniformly transform the logical room only during rendering; never resize room coordinates or physics to match the drawing buffer, so display changes preserve combat balance.
