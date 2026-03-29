all: gradience.pdf

gradience.pdf: gradience.tex
	pdflatex -interaction=nonstopmode gradience.tex
	pdflatex -interaction=nonstopmode gradience.tex

clean:
	rm -f *.aux *.log *.out *.toc *.fls *.fdb_latexmk *.synctex.gz

.PHONY: all clean
