#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { TodoistApi } from "@doist/todoist-api-typescript";

// Define tools
const CREATE_TASK_TOOL: Tool = {
  name: "todoist_create_task",
  description: "Create a new task in Todoist with optional description, due date, and priority",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The content/title of the task"
      },
      description: {
        type: "string",
        description: "Detailed description of the task (optional)"
      },
      project_id: {
        type: "string",
        description: "ID of the project to add the task to (optional)"
      },
      due_string: {
        type: "string",
        description: "Natural language due date like 'tomorrow', 'next Monday', 'Jan 23' (optional)"
      },
      priority: {
        type: "number",
        description: "Task priority from 1 (normal) to 4 (urgent) (optional)",
        enum: [1, 2, 3, 4]
      }
    },
    required: ["content"]
  }
};

const GET_TASKS_TOOL: Tool = {
  name: "todoist_get_tasks",
  description: "Get a list of tasks from Todoist with various filters",
  inputSchema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "Filter tasks by project ID (optional)"
      },
      filter: {
        type: "string",
        description: "Natural language filter like 'today', 'tomorrow', 'next week', 'priority 1', 'overdue' (optional)"
      },
      priority: {
        type: "number",
        description: "Filter by priority level (1-4) (optional)",
        enum: [1, 2, 3, 4]
      },
      limit: {
        type: "number",
        description: "Maximum number of tasks to return (optional)",
        default: 10
      }
    }
  }
};

const UPDATE_TASK_TOOL: Tool = {
  name: "todoist_update_task",
  description: "Update an existing task in Todoist by searching for it by name and then updating it",
  inputSchema: {
    type: "object",
    properties: {
      task_name: {
        type: "string",
        description: "Name/content of the task to search for and update"
      },
      content: {
        type: "string",
        description: "New content/title for the task (optional)"
      },
      project_id: {  // Add this
        type: "string",
        description: "New project ID to move the task to (optional)"
      },
      description: {
        type: "string",
        description: "New description for the task (optional)"
      },
      due_string: {
        type: "string",
        description: "New due date in natural language like 'tomorrow', 'next Monday' (optional)"
      },
      priority: {
        type: "number",
        description: "New priority level from 1 (normal) to 4 (urgent) (optional)",
        enum: [1, 2, 3, 4]
      }
    },
    required: ["task_name"]
  }
};

const DELETE_TASK_TOOL: Tool = {
  name: "todoist_delete_task",
  description: "Delete a task from Todoist by searching for it by name",
  inputSchema: {
    type: "object",
    properties: {
      task_name: {
        type: "string",
        description: "Name/content of the task to search for and delete"
      }
    },
    required: ["task_name"]
  }
};

const COMPLETE_TASK_TOOL: Tool = {
  name: "todoist_complete_task",
  description: "Mark a task as complete by searching for it by name",
  inputSchema: {
    type: "object",
    properties: {
      task_name: {
        type: "string",
        description: "Name/content of the task to search for and complete"
      }
    },
    required: ["task_name"]
  }
};

// Project-related tools
const GET_PROJECTS_TOOL: Tool = {
  name: "todoist_get_projects",
  description: "Get all projects from Todoist",
  inputSchema: {
    type: "object",
    properties: {}  // No required parameters
  }
};

const GET_PROJECT_TOOL: Tool = {
  name: "todoist_get_project",
  description: "Get a specific project by ID",
  inputSchema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "ID of the project to retrieve"
      }
    },
    required: ["project_id"]
  }
};

const CREATE_PROJECT_TOOL: Tool = {
  name: "todoist_create_project",
  description: "Create a new project in Todoist",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the project"
      },
      parent_id: {
        type: "string",
        description: "Parent project ID (optional)"
      },
      color: {
        type: "string",
        description: "The color of the project icon (optional)"
      },
      is_favorite: {
        type: "boolean",
        description: "Whether the project is a favorite (optional)"
      },
      view_style: {
        type: "string",
        description: "Display style: 'list' or 'board' (optional)",
        enum: ["list", "board"]
      }
    },
    required: ["name"]
  }
};

const UPDATE_PROJECT_TOOL: Tool = {
  name: "todoist_update_project",
  description: "Update an existing project in Todoist",
  inputSchema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "ID of the project to update"
      },
      name: {
        type: "string",
        description: "New name for the project (optional)"
      },
      color: {
        type: "string",
        description: "New color for the project icon (optional)"
      },
      is_favorite: {
        type: "boolean",
        description: "Whether the project is a favorite (optional)"
      },
      view_style: {
        type: "string",
        description: "Display style: 'list' or 'board' (optional)",
        enum: ["list", "board"]
      }
    },
    required: ["project_id"]
  }
};

const DELETE_PROJECT_TOOL: Tool = {
  name: "todoist_delete_project",
  description: "Delete a project and all its tasks",
  inputSchema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "ID of the project to delete"
      }
    },
    required: ["project_id"]
  }
};

// Project-related type guards
function isGetProjectArgs(args: unknown): args is {
  project_id: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "project_id" in args &&
    typeof (args as { project_id: string }).project_id === "string"
  );
}

function isCreateProjectArgs(args: unknown): args is {
  name: string;
  parent_id?: string;
  color?: string;
  is_favorite?: boolean;
  view_style?: "list" | "board";
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "name" in args &&
    typeof (args as { name: string }).name === "string"
  );
}

function isUpdateProjectArgs(args: unknown): args is {
  project_id: string;
  name?: string;
  color?: string;
  is_favorite?: boolean;
  view_style?: "list" | "board";
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "project_id" in args &&
    typeof (args as { project_id: string }).project_id === "string"
  );
}

function isDeleteProjectArgs(args: unknown): args is {
  project_id: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "project_id" in args &&
    typeof (args as { project_id: string }).project_id === "string"
  );
}

// Server implementation
const server = new Server(
  {
    name: "todoist-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Check for API token
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN!;
if (!TODOIST_API_TOKEN) {
  console.error("Error: TODOIST_API_TOKEN environment variable is required");
  process.exit(1);
}

// Initialize Todoist client
const todoistClient = new TodoistApi(TODOIST_API_TOKEN);

// Type guards for arguments
function isCreateTaskArgs(args: unknown): args is { 
  content: string;
  description?: string;
  project_id?: string;
  due_string?: string;
  priority?: number;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "content" in args &&
    typeof (args as { content: string }).content === "string"
  );
}

function isGetTasksArgs(args: unknown): args is { 
  project_id?: string;
  filter?: string;
  priority?: number;
  limit?: number;
} {
  return (
    typeof args === "object" &&
    args !== null
  );
}

function isUpdateTaskArgs(args: unknown): args is {
  task_name: string;
  content?: string;
  project_id?: string;  // Add this
  description?: string;
  due_string?: string;
  priority?: number;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "task_name" in args &&
    typeof (args as { task_name: string }).task_name === "string"
  );
}

function isDeleteTaskArgs(args: unknown): args is {
  task_name: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "task_name" in args &&
    typeof (args as { task_name: string }).task_name === "string"
  );
}

function isCompleteTaskArgs(args: unknown): args is {
  task_name: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "task_name" in args &&
    typeof (args as { task_name: string }).task_name === "string"
  );
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    CREATE_TASK_TOOL, 
    GET_TASKS_TOOL, 
    UPDATE_TASK_TOOL, 
    DELETE_TASK_TOOL, 
    COMPLETE_TASK_TOOL,
    GET_PROJECTS_TOOL,
    GET_PROJECT_TOOL,
    CREATE_PROJECT_TOOL,
    UPDATE_PROJECT_TOOL,
    DELETE_PROJECT_TOOL
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    if (name === "todoist_create_task") {
      if (!isCreateTaskArgs(args)) {
        throw new Error("Invalid arguments for todoist_create_task");
      }
      const task = await todoistClient.addTask({
        content: args.content,
        description: args.description,
        projectId: args.project_id,  // Add this line
        dueString: args.due_string,
        priority: args.priority
      });
      return {
        content: [{ 
          type: "text", 
          text: `Task created:\nTitle: ${task.content}${task.description ? `\nDescription: ${task.description}` : ''}${task.projectId ? `\nProject ID: ${task.projectId}` : ''}${task.due ? `\nDue: ${task.due.string}` : ''}${task.priority ? `\nPriority: ${task.priority}` : ''}` 
        }],
        isError: false,
      };
    }

    if (name === "todoist_get_projects") {
      const projects = await todoistClient.getProjects();
      return {
        content: [{ 
          type: "text", 
          text: projects.map(project => 
            `- ${project.name}\n  ID: ${project.id}${project.parentId ? `\n  Parent ID: ${project.parentId}` : ''}\n  Color: ${project.color}\n  Favorite: ${project.isFavorite}`
          ).join('\n\n')
        }],
        isError: false,
      };
    }

    if (name === "todoist_get_project") {
      if (!isGetProjectArgs(args)) {
        throw new Error("Invalid arguments for todoist_get_project");
      }
      const project = await todoistClient.getProject(args.project_id);
      return {
        content: [{ 
          type: "text", 
          text: `Project Details:\nName: ${project.name}\nID: ${project.id}${project.parentId ? `\nParent ID: ${project.parentId}` : ''}\nColor: ${project.color}\nFavorite: ${project.isFavorite}` 
        }],
        isError: false,
      };
    }

    if (name === "todoist_create_project") {
      if (!isCreateProjectArgs(args)) {
        throw new Error("Invalid arguments for todoist_create_project");
      }
      const project = await todoistClient.addProject({
        name: args.name,
        parentId: args.parent_id,
        color: args.color,
        isFavorite: args.is_favorite,
        viewStyle: args.view_style
      });
      return {
        content: [{ 
          type: "text", 
          text: `Project created:\nName: ${project.name}\nID: ${project.id}${project.parentId ? `\nParent ID: ${project.parentId}` : ''}\nColor: ${project.color}\nFavorite: ${project.isFavorite}` 
        }],
        isError: false,
      };
    }

    if (name === "todoist_update_project") {
      if (!isUpdateProjectArgs(args)) {
        throw new Error("Invalid arguments for todoist_update_project");
      }
      const updateData: any = {};
      if (args.name) updateData.name = args.name;
      if (args.color) updateData.color = args.color;
      if (args.is_favorite !== undefined) updateData.isFavorite = args.is_favorite;
      if (args.view_style) updateData.viewStyle = args.view_style;

      const project = await todoistClient.updateProject(args.project_id, updateData);
      return {
        content: [{ 
          type: "text", 
          text: `Project updated:\nName: ${project.name}\nID: ${project.id}\nColor: ${project.color}\nFavorite: ${project.isFavorite}` 
        }],
        isError: false,
      };
    }

    if (name === "todoist_delete_project") {
      if (!isDeleteProjectArgs(args)) {
        throw new Error("Invalid arguments for todoist_delete_project");
      }
      await todoistClient.deleteProject(args.project_id);
      return {
        content: [{ 
          type: "text", 
          text: `Successfully deleted project with ID: ${args.project_id}` 
        }],
        isError: false,
      };
    }

    if (name === "todoist_get_tasks") {
      if (!isGetTasksArgs(args)) {
        throw new Error("Invalid arguments for todoist_get_tasks");
      }
      
      const tasks = await todoistClient.getTasks({
        projectId: args.project_id,
        filter: args.filter
      });

      // Apply additional filters
      let filteredTasks = tasks;
      if (args.priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === args.priority);
      }
      
      // Apply limit
      if (args.limit && args.limit > 0) {
        filteredTasks = filteredTasks.slice(0, args.limit);
      }
      
      const taskList = filteredTasks.map(task => 
        `- ${task.content}${task.description ? `\n  Description: ${task.description}` : ''}${task.due ? `\n  Due: ${task.due.string}` : ''}${task.priority ? `\n  Priority: ${task.priority}` : ''}`
      ).join('\n\n');
      
      return {
        content: [{ 
          type: "text", 
          text: filteredTasks.length > 0 ? taskList : "No tasks found matching the criteria" 
        }],
        isError: false,
      };
    }

    if (name === "todoist_update_task") {
      if (!isUpdateTaskArgs(args)) {
        throw new Error("Invalid arguments for todoist_update_task");
      }
    
      // First, search for the task
      const tasks = await todoistClient.getTasks();
      const matchingTask = tasks.find(task => 
        task.content.toLowerCase().includes(args.task_name.toLowerCase())
      );
    
      if (!matchingTask) {
        return {
          content: [{ 
            type: "text", 
            text: `Could not find a task matching "${args.task_name}"` 
          }],
          isError: true,
        };
      }
    
      // Build update data
      const updateData: any = {};
      if (args.content) updateData.content = args.content;
      if (args.description) updateData.description = args.description;
      if (args.due_string) updateData.dueString = args.due_string;
      if (args.priority) updateData.priority = args.priority;
      if (args.project_id) updateData.projectId = args.project_id;  // Make sure this matches the API's expected format
    
      try {
        const updatedTask = await todoistClient.updateTask(matchingTask.id, updateData);
        return {
          content: [{ 
            type: "text", 
            text: `Task "${matchingTask.content}" updated:\nNew Title: ${updatedTask.content}${updatedTask.description ? `\nNew Description: ${updatedTask.description}` : ''}${updatedTask.projectId ? `\nNew Project ID: ${updatedTask.projectId}` : ''}${updatedTask.due ? `\nNew Due Date: ${updatedTask.due.string}` : ''}${updatedTask.priority ? `\nNew Priority: ${updatedTask.priority}` : ''}` 
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error updating task: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true,
        };
      }
    }

    if (name === "todoist_delete_task") {
      if (!isDeleteTaskArgs(args)) {
        throw new Error("Invalid arguments for todoist_delete_task");
      }

      // First, search for the task
      const tasks = await todoistClient.getTasks();
      const matchingTask = tasks.find(task => 
        task.content.toLowerCase().includes(args.task_name.toLowerCase())
      );

      if (!matchingTask) {
        return {
          content: [{ 
            type: "text", 
            text: `Could not find a task matching "${args.task_name}"` 
          }],
          isError: true,
        };
      }

      // Delete the task
      await todoistClient.deleteTask(matchingTask.id);
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully deleted task: "${matchingTask.content}"` 
        }],
        isError: false,
      };
    }

    if (name === "todoist_complete_task") {
      if (!isCompleteTaskArgs(args)) {
        throw new Error("Invalid arguments for todoist_complete_task");
      }

      // First, search for the task
      const tasks = await todoistClient.getTasks();
      const matchingTask = tasks.find(task => 
        task.content.toLowerCase().includes(args.task_name.toLowerCase())
      );

      if (!matchingTask) {
        return {
          content: [{ 
            type: "text", 
            text: `Could not find a task matching "${args.task_name}"` 
          }],
          isError: true,
        };
      }

      // Complete the task
      await todoistClient.closeTask(matchingTask.id);
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully completed task: "${matchingTask.content}"` 
        }],
        isError: false,
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Todoist MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});