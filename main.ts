import {
	App,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	addIcon,
} from "obsidian";
import { ICON_DATA } from "resources/icons";

interface HeaderCounterPluginSettings {
	defaultLevel: string;
}

const DEFAULT_SETTINGS: HeaderCounterPluginSettings = {
	defaultLevel: "4",
};

export default class HeaderCounterPlugin extends Plugin {
	settings: HeaderCounterPluginSettings;

	async onload() {
		console.log("Loading Header Counter Plugin");

		await this.loadSettings();

		addIcon("header", ICON_DATA);

		this.addRibbonIcon("header", "Header Counter", () => {
			const view = this.app.workspace.getActiveViewOfType(
				MarkdownView
			) as MarkdownView;
			new HeaderLevelModal(
				this.app,
				(headerLevel) => {
					this.countHeaders(view, headerLevel);
				},
				parseInt(this.settings.defaultLevel)
			).open();
		});

		this.addSettingTab(new HeaderCounterSettingTab(this.app, this));

		this.addCommand({
			id: "count-headers",
			name: "Count headers",
			checkCallback: (checking: boolean) => {
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (checking) {
					return !!view;
				}

				// Prompt user for header level input
				new HeaderLevelModal(
					this.app,
					(headerLevel) => {
						this.countHeaders(view as MarkdownView, headerLevel);
					},
					parseInt(this.settings.defaultLevel)
				).open();
			},
		});

		this.addCommand({
			id: "header-summary",
			name: "Compute header summary",
			checkCallback: (checking: boolean) => {
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (checking) {
					return !!view;
				}
				this.computeHeaderSummary(view as MarkdownView);
			},
		});
	}

	onunload() {
		console.log("Unloading Header Counter Plugin");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async countHeaders(view: MarkdownView, headerLevel: number) {
		const editor = view.editor;
		const content = editor.getValue();

		const headerRegex = new RegExp(`^#{${headerLevel}}\\s`, "gm");
		const matches = content.match(headerRegex);
		const count = matches ? matches.length : 0;

		new Notice(`Number of level ${headerLevel} headers: ${count}`);
	}

	async computeHeaderSummary(view: MarkdownView) {
		const editor = view.editor;
		const content = editor.getValue();

		const headerSummary: { [key: string]: number } = {};

		for (let level = 1; level <= 6; level++) {
			const headerRegex = new RegExp(`^#{${level}}\\s`, "gm");
			const matches = content.match(headerRegex);
			headerSummary[`h${level}`] = matches ? matches.length : 0;
		}

		new Notice(`Header summary: ${JSON.stringify(headerSummary)}`);
		new Notice("Copied to clipboard!");
		navigator.clipboard.writeText(JSON.stringify(headerSummary));
	}
}

class HeaderLevelModal extends Modal {
	callback: (headerLevel: number) => void;
	defaultHeaderLevel: number;

	constructor(
		app: App,
		callback: (headerLevel: number) => void,
		defaultHeaderLevel: number
	) {
		super(app);
		this.callback = callback;
		this.defaultHeaderLevel = defaultHeaderLevel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Enter header level (1-6)" });

		const input = contentEl.createEl("input", {
			type: "number",
			attr: {
				min: "1",
				max: "6",
				value: this.defaultHeaderLevel.toString(),
				placeholder: this.defaultHeaderLevel.toString(),
			},
		});
		input.addClass("header-input");
		input.focus();

		const button = contentEl.createEl("button", { text: "Count" });
		button.addEventListener("click", () => {
			this.handleCount(input);
		});

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				this.handleCount(input);
			}
		});
	}

	handleCount(input: HTMLInputElement) {
		const headerLevel = parseInt(input.value);
		if (headerLevel >= 1 && headerLevel <= 6) {
			this.callback(headerLevel);
			this.close();
		} else {
			new Notice("Please enter a valid header level (1-6).");
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class HeaderCounterSettingTab extends PluginSettingTab {
	plugin: HeaderCounterPlugin;

	constructor(app: App, plugin: HeaderCounterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		this.set_default_header();
	}

	set_default_header(): void {
		const desc = document.createDocumentFragment();
		desc.append("Set the default header level to count.");

		new Setting(this.containerEl)
			.setName("Default header level")
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder("Enter a number between 1 and 6")
					.setValue(this.plugin.settings.defaultLevel.toString())
					.onChange(async (value) => {
						const level = parseInt(value);
						if (level >= 1 && level <= 6) {
							this.plugin.settings.defaultLevel =
								level.toString();
							await this.plugin.saveSettings();
						} else {
							new Notice(
								"Please enter a valid number between 1 and 6."
							);
						}
					})
			);
	}
}
