import { useId } from "react";
import type { GroupWithDetails } from "~/types/types";
import { useGroupModal } from "~/hooks/use-group-modal";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editGroup?: GroupWithDetails | null;
}

export function GroupModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  editGroup 
}: GroupModalProps) {
  const id = useId();

  const {
    groupName,
    setGroupName,
    selectedMembers,
    selectedDocuments,
    users,
    documents,
    loading,
    error,
    toggleMember,
    toggleDocument,
    handleSubmit,
    handleDelete,
    resetForm,
  } = useGroupModal({ isOpen, editGroup });

  const onSubmit = async (e: React.FormEvent) => {
    try {
      await handleSubmit(e);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Submit failed:", err);
    }
  };

  const onDelete = async () => {
    try {
      await handleDelete();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // console.log(selectedMembers)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col gap-0 overflow-y-visible p-0 sm:max-w-2xl [&>button:last-child]:top-3.5 border-2">
        {/* Header */}
        <DialogHeader className="contents space-y-0 text-left">
          <DialogTitle className="border-b border-cyan-500/30 dark:border-cyan-400/20 px-6 py-4 text-base uppercase tracking-wider">
            {editGroup ? "⚡ Edit Group" : "⚡ Create New Group"}
          </DialogTitle>
        </DialogHeader>
        
        <DialogDescription className="sr-only">
          {editGroup 
            ? "Edit group details, add or remove members and documents, or delete the group." 
            : "Create a new group by providing a name and optionally adding members and documents."}
        </DialogDescription>

        {/* Scrollable Content */}
        <div className="overflow-y-auto">
          <div className="px-6 pt-6 pb-6">
            {/* Error Display */}
            {error && (
              <div className="mb-4 rounded-md border-2 border-pink-500/50 bg-pink-500/10 dark:bg-pink-500/20 px-4 py-3 text-sm text-pink-600 dark:text-pink-400 font-mono">
                ⚠ {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={onSubmit}>
              {/* Group Name */}
              <div className="space-y-2">
                <Label htmlFor={`${id}-group-name`} className="text-cyan-600 dark:text-cyan-400 font-semibold tracking-wide">
                  Group Name <span className="text-pink-500 dark:text-pink-400">*</span>
                </Label>
                <Input
                  id={`${id}-group-name`}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  required
                  disabled={loading}
                  aria-required="true"
                  className="border-cyan-500/30 dark:border-cyan-400/30 focus:border-cyan-500 dark:focus:border-cyan-400 font-mono"
                />
              </div>

              {/* Members Selection */}
              <div className="space-y-2">
                <Label htmlFor={`${id}-members`} className="text-purple-600 dark:text-purple-400 font-semibold tracking-wide">
                  Add Members <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <div
                  id={`${id}-members`}
                  className="max-h-48 overflow-y-auto rounded-md border-2 border-purple-500/30 dark:border-purple-400/30 bg-purple-500/5 dark:bg-purple-500/10"
                  role="group"
                  aria-label="Member selection"
                >
                  {users.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No users available
                    </div>
                  ) : (
                    users.map((user) => (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-center px-4 py-2 hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(user.id)}
                          onChange={() => toggleMember(user.id)}
                          disabled={loading}
                          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          aria-label={`Add ${user.name} to group`}
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedMembers.length > 0 && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              {/* Documents Selection */}
              <div className="space-y-2">
                <Label htmlFor={`${id}-documents`} className="text-pink-600 dark:text-pink-400 font-semibold tracking-wide">
                  Add Documents <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <div
                  id={`${id}-documents`}
                  className="max-h-48 overflow-y-auto rounded-md border-2 border-pink-500/30 dark:border-pink-400/30 bg-pink-500/5 dark:bg-pink-500/10"
                  role="group"
                  aria-label="Document selection"
                >
                  {documents.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No documents available
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex cursor-pointer items-center px-4 py-2 hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={() => toggleDocument(doc.id)}
                          disabled={loading}
                          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          aria-label={`Add ${doc.title} to group`}
                        />
                        <div className="ml-3 text-sm">{doc.title}</div>
                      </label>
                    ))
                  )}
                </div>
                {selectedDocuments.length > 0 && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Footer with Actions */}
        <DialogFooter className="flex-row justify-between border-t border-cyan-500/30 dark:border-cyan-400/20 px-6 py-4 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5">
          {/* Delete button (only when editing) */}
          {editGroup && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={loading}
              className="bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 border-0 font-semibold tracking-wide"
            >
              {loading ? "⚡ Deleting..." : "🗑 Delete Group"}
            </Button>
          )}

          {/* Spacer when not editing */}
          {!editGroup && <div />}

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading} className="border-cyan-500/50 dark:border-cyan-400/50 hover:border-cyan-500 dark:hover:border-cyan-400 font-semibold">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={loading || !groupName.trim()}
              className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 border-0 font-semibold tracking-wide shadow-lg shadow-cyan-500/20"
            >
              {loading
                ? (editGroup ? "⚡ Updating..." : "⚡ Creating...")
                : (editGroup ? "✓ Update Group" : "✓ Create Group")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
