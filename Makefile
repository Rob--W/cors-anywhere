GIT_COMMIT?=$(shell git rev-parse HEAD)
BRANCH_NAME?=$(shell git rev-parse --abbrev-ref HEAD)
BRANCH_TAG=$(subst /,_,$(BRANCH_NAME))

DOCKER_NAME=cors_anywhere
DOCKER_REPO=eu.gcr.io/platform-v2-project
DOCKER_IMAGE=${DOCKER_NAME}:${GIT_COMMIT}
DOCKER_BRANCH_IMAGE=${DOCKER_NAME}:${BRANCH_TAG}-latest
KUBE_NAMESPACE=cors-anywhere-${BRANCH_TAG}
HELM_NAME=cors-anywhere-${BRANCH_TAG}
CHARTS_DIR=charts/cors-anywhere
VALUES_FILE=${CHARTS_DIR}/values-${BRANCH_TAG}.yaml

run:
	docker run -p 8080:8080 -t ${DOCKER_IMAGE}

down:
	docker kill `docker ps -a -q --filter ancestor=${DOCKER_IMAGE}`

clean:
	docker rm `docker ps -a -q --filter ancestor=${DOCKER_IMAGE}`

build:
	docker build \
		-t ${DOCKER_IMAGE} \
		-t ${DOCKER_BRANCH_IMAGE} \
		-t ${DOCKER_REPO}/${DOCKER_IMAGE} \
		-t ${DOCKER_REPO}/${DOCKER_BRANCH_IMAGE} \
		.

release:
	docker push ${DOCKER_REPO}/${DOCKER_IMAGE}
	docker push ${DOCKER_REPO}/${DOCKER_BRANCH_IMAGE}

helm_install:
	@if [ ${BRANCH_TAG} = "master" ]; then \
		helm install --name ${HELM_NAME} --namespace production ${CHARTS_DIR} -f ${CHARTS_DIR}/values-${BRANCH_TAG}-primary.yaml --set image.tag=${BRANCH_TAG}-latest ; \
	else \
		helm install --name ${HELM_NAME} --namespace development ${CHARTS_DIR} -f ${CHARTS_DIR}/values-${BRANCH_TAG}-primary.yaml ; \
	fi

helm_upgrade:
	helm dependency build ${CHARTS_DIR}
	helm upgrade ${HELM_NAME} ${CHARTS_DIR} --reuse-values -f ${CHARTS_DIR}/values-${BRANCH_TAG}-primary.yaml --set image.tag=${GIT_COMMIT}
