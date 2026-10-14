"use client";

import { useState } from "react";
import type { Project } from "@/lib/domain/types";
import { createId, createProject, updateProjectDetails } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { Dialog } from "./Dialog";
import { Button, Field, InlineAlert, TextArea, TextInput } from "./ui";

interface ProjectFormProps {
  open: boolean;
  /** Present when editing. */
  project?: Project;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

/** Create a project (all eight phases start at 0 min) or edit its name and description. */
export function ProjectForm(props: ProjectFormProps) {
  // Mounting only while open gives every opening a fresh form.
  if (!props.open) return null;
  return <ProjectFormDialog {...props} />;
}

function ProjectFormDialog({ project, onClose, onCreated }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const now = new Date().toISOString();
    const id = createId();
    const result = run((data) =>
      project
        ? updateProjectDetails(data, project.id, { name, description }, now)
        : createProject(data, { name, description }, now, id),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    if (!project) onCreated?.(id);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      title={project ? "Edit project" : "New project"}
      description={project ? undefined : "All eight PSP phases start with a 0-minute estimate."}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="project-name">
          <TextInput
            id="project-name"
            value={name}
            maxLength={120}
            data-autofocus
            autoComplete="off"
            placeholder="e.g. Program 4A — Relative size table"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </Field>
        <Field label="Description" htmlFor="project-description" hint="Optional">
          <TextArea
            id="project-description"
            value={description}
            rows={3}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        {error && <InlineAlert>{error}</InlineAlert>}
      </div>
    </Dialog>
  );
}
