-- Upgrades sharing from read-only to jointly editable: whoever a note is
-- shared with can now edit it too, not just view/copy it.
create policy "Recipient can edit a note shared with them"
  on notes for update
  using (
    exists (
      select 1 from note_shares
      where note_shares.note_id = notes.id
        and note_shares.shared_with_id = auth.uid()
    )
  );
