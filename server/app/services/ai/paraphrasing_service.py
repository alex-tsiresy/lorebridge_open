from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.chat_models import ChatOpenAI


class ParaphrasingService:
    def __init__(self, llm_provider: str, api_key: str):
        self.llm_provider = llm_provider
        self.api_key = api_key

    def _get_paraphraser_chain(self):
        """Initialises and returns an LLMChain configured for paraphrasing and filtering."""
        if self.llm_provider == "openai":
            llm = ChatOpenAI(
                temperature=0.3,
                model_name="gpt-4.1",  # Using 4o-mini as requested
                openai_api_key=self.api_key,
            )
            prompt = PromptTemplate(
                input_variables=["text"],
                template=(
                    "1. **Introduction**"
                    "   - You will generate a **Mermaid diagram** using the Mermaid syntax."
                    "   - Focus solely on producing a valid Mermaid diagram, with no additional content."
                    ""
                    "2. **Syntax Guidelines**"
                    "   - Begin with the appropriate diagram type identifier:"
                    "     - **Flowchart**: Use `graph TD` for top-down, `graph LR` for left-right."
                    "     - **Sequence Diagram**: Use `sequenceDiagram` to represent interactions."
                    "     - **Class Diagram**: Use `classDiagram` to depict class structures."
                    "     - **State Diagram**: Use `stateDiagram-v2` for state transitions."
                    "     - **Gantt Chart**: Use `gantt` for project timelines."
                    "     - **Entity-Relationship Diagram (ERD)**: Use `erDiagram` for database schemas."
                    "   - Use **arrows** (`-->`, `-.-`), **nodes** (`A`, `B`, `[A]`, `(B)`), and **links** to define relationships."
                    "   - Incorporate **labels** on arrows and nodes for clarity."
                    "   - Include styling options for nodes and edges using `style` and `classDef`."
                    "   - Ensure syntax is consistent with [Mermaid's syntax reference](https://mermaid.js.org/intro/syntax-reference.html)."
                    ""
                    "3. **Content and Format**"
                    "   - IMPORTANT: **Self-determine** the content and format of the graph based on the provided context."
                    "   - Consider the relationships, hierarchies, or sequences that need representation."
                    "   - Choose the diagram type that best suits the context."
                    "   - Ensure the diagram is **clear** and **accurate** in portraying the intended information."
                    ""
                    "4. **Validation**"
                    "   - Ensure the generated diagram syntax is **error-free** and **ready** for rendering."
                    "   - Test the diagram using a [Mermaid live editor](https://mermaid.live/) to confirm compatibility."
                    ""
                    "5. **Additional Tips**"
                    "   - Use **comments** within the code block to explain any non-obvious choices."
                    "   - For complex diagrams, consider using subgraphs to organize elements logically."
                    "   - Leverage Mermaid's built-in themes to enhance the visual appeal of diagrams."
                    "Context: \n{text}\n\n Generated mermaid code:"
                ),
            )
            return LLMChain(llm=llm, prompt=prompt)
        # Additional providers can be added here in the future
        raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")

    def paraphrase(self, text: str) -> str:
        """Paraphrases the input text, using the largest possible chunk size. Only chunk if necessary."""
        paraphraser = self._get_paraphraser_chain()
        max_chunk_size = 20000  
        if len(text) <= max_chunk_size:
            return paraphraser.run({"text": text}).strip()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=max_chunk_size, chunk_overlap=0
        )
        chunks = text_splitter.split_text(text)
        paraphrased_chunks = [
            paraphraser.run({"text": chunk}).strip() for chunk in chunks
        ]
        return "\n\n".join(paraphrased_chunks)
