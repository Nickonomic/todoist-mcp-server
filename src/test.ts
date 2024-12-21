import { TodoistApi } from "@doist/todoist-api-typescript";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN!;
if (!TODOIST_API_TOKEN) {
    console.error("Error: TODOIST_API_TOKEN environment variable is required");
    process.exit(1);
}

// Initialize Todoist client
const api = new TodoistApi(TODOIST_API_TOKEN!);

async function testTodoistAPI() {
    try {
        // 1. List all projects to find target project (Dev)
        console.log("\nListing all projects...");
        const projects = await api.getProjects();
        console.log("Projects:", projects.map(p => ({ id: p.id, name: p.name })));

        const targetProject = projects.find(p => p.name === "Dev");
        if (!targetProject) {
            throw new Error("Target project (Dev) not found!");
        }
        console.log("\nFound target project:", { id: targetProject.id, name: targetProject.name });

        // 2. Create a task in Inbox
        console.log("\nCreating test task in Inbox...");
        const task = await api.addTask({
            content: "Test task for moving between projects",
            description: "This task should be moved to Dev project"
        });
        console.log("Created task:", { id: task.id, content: task.content, projectId: task.projectId });

        // 3. Create new task in target project with same content
        console.log("\nRecreating task in Dev project...");
        const newTask = await api.addTask({
            content: task.content,
            description: task.description,
            projectId: targetProject.id
        });
        console.log("Created new task:", { id: newTask.id, content: newTask.content, projectId: newTask.projectId });

        // 4. Delete the original task
        console.log("\nDeleting original task...");
        await api.deleteTask(task.id);
        console.log("Original task deleted");

        // 5. Verify the result
        const finalTask = await api.getTask(newTask.id);
        console.log("Final task state:", {
            id: finalTask.id,
            content: finalTask.content,
            projectId: finalTask.projectId
        });

    } catch (error) {
        console.error("Error:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
        }
    }
}

// Run the test
testTodoistAPI().then(() => console.log("\nTest completed")); 