import Link from "next/link";

export const metadata = {
	title: "FAQ | Pawan.Krd Playground",
	description: "Frequently asked questions about data privacy, providers, and purpose of the app.",
};

export default function FAQPage() {
	return (
		<main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 md:px-8">
			<h1 className="mb-6 text-3xl font-bold tracking-tight">FAQ</h1>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">What is this app?</h2>
				<p className="text-muted-foreground">This is an open-source playground for chatting with AI characters. It helps you experiment with prompts, personas, and different model providers, all inside a clean, local-first UI.</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">Is this app open source?</h2>
				<p className="text-muted-foreground">
					Yes. The project is open source. You can review, self-host, or contribute to the codebase. See the GitHub link in the header, or visit{" "}
					<a className="underline hover:no-underline" href="https://github.com/PawanOsman/CharPlay" target="_blank" rel="noreferrer">
						https://github.com/PawanOsman/CharPlay
					</a>
					.
				</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">How is my data stored?</h2>
				<ul className="list-disc space-y-2 pl-6 text-muted-foreground">
					<li>All chats, conversations, settings, and uploaded characters are stored locally in your browser (localStorage).</li>
					<li>There is no account system or server-side database in this app.</li>
					<li>You can export/import a full backup from the Home page.</li>
				</ul>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">Do you store any user data on your servers?</h2>
				<p className="text-muted-foreground">No. We don’t store any user data on our servers. Your chats, settings, and characters remain in your browser.</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">Who is the AI provider?</h2>
				<ul className="list-disc space-y-2 pl-6 text-muted-foreground">
					<li>
						<span className="font-medium text-foreground">Pawan.Krd</span>: This playground is built and operated by Pawan.Krd, and it uses our models and APIs by default.
					</li>
					<li>
						<span className="font-medium text-foreground">OpenAI-compatible</span>: You can optionally connect any OpenAI-compatible endpoint by entering your base URL and API key in settings.
					</li>
				</ul>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">If I use an OpenAI-compatible provider, will they log usage?</h2>
				<p className="text-muted-foreground">
					If you connect an OpenAI-compatible endpoint, your usage may be logged according to that provider’s policies. Using any third-party provider is entirely between you and that provider, Pawan.Krd is not affiliated with, nor responsible for, those services. You are solely responsible for compliance,
					data handling, billing, and terms when using any other provider. For the best privacy and experience, we recommend using Pawan.Krd as the provider.
				</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">Where is my API key stored?</h2>
				<p className="text-muted-foreground">Your API keys and base URL are stored locally in your browser.</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">Do you track me or run analytics?</h2>
				<p className="text-muted-foreground">No analytics or tracking are included. The app uses a lightweight socket connection only to display the online counter; no chat content is transmitted through that channel.</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">Can I self-host?</h2>
				<p className="text-muted-foreground">Yes. Clone the repository, set the environment variables, and run it locally or deploy it to your platform of choice.</p>
			</section>

			<section className="mt-10 space-y-4">
				<h2 className="text-xl font-semibold">How do I report issues or request features?</h2>
				<p className="text-muted-foreground">
					Please open an issue or pull request in the GitHub repository at{" "}
					<a className="underline hover:no-underline" href="https://github.com/PawanOsman/CharPlay" target="_blank" rel="noreferrer">
						https://github.com/PawanOsman/CharPlay
					</a>
					. Contributions are welcome.
				</p>
			</section>
		</main>
	);
}
