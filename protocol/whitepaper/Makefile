all: gradience-en.pdf gradience-zh.pdf

gradience-en.pdf: gradience-en.tex
	pdflatex -interaction=nonstopmode gradience-en.tex
	pdflatex -interaction=nonstopmode gradience-en.tex

gradience-zh.pdf: gradience-zh.tex
	xelatex -interaction=nonstopmode gradience-zh.tex
	xelatex -interaction=nonstopmode gradience-zh.tex

en: gradience-en.pdf
zh: gradience-zh.pdf

clean:
	rm -f *.aux *.log *.out *.toc *.fls *.fdb_latexmk *.synctex.gz

.PHONY: all en zh clean
